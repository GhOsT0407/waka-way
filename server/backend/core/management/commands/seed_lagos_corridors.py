"""
Management command to seed Lagos transport corridors from JSON data
"""
import json
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.models import City, TransportStop, Corridor, CorridorStop, StopConnection


class Command(BaseCommand):
    help = 'Seed Lagos transport corridors from JSON data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            default='waka_way_corridors.json',
            help='Path to the JSON file containing corridor data'
        )
        parser.add_argument(
            '--city',
            type=str,
            default='Lagos',
            help='City name to associate corridors with'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        json_file = options['file']
        city_name = options['city']

        # Get or create Lagos city
        try:
            city = City.objects.get(name=city_name)
            self.stdout.write(self.style.SUCCESS(f"Using existing city: {city.name}"))
        except City.DoesNotExist:
            city = City.objects.create(
                name=city_name,
                state='Lagos State',
                country='Nigeria',
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS(f"Created city: {city.name}"))

        # Load JSON data
        try:
            with open(json_file, 'r') as f:
                data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"JSON file not found: {json_file}")
        except json.JSONDecodeError:
            raise CommandError(f"Invalid JSON in file: {json_file}")

        # Extract corridors
        corridors_data = data.get('lagos_transport_network', {}).get('corridors', [])
        if not corridors_data:
            raise CommandError("No corridors found in JSON data")

        self.stdout.write(f"\nProcessing {len(corridors_data)} corridors...\n")

        created_count = 0
        for corridor_data in corridors_data:
            corridor = self._create_corridor(city, corridor_data)
            if corridor:
                created_count += 1
                self._create_corridor_stops(corridor, corridor_data.get('stops', []))
                self._create_connections(corridor, corridor_data.get('stops', []))

        self.stdout.write(self.style.SUCCESS(f"\n✓ Successfully seeded {created_count} corridors"))

    def _create_corridor(self, city, corridor_data):
        """Create or update a corridor"""
        corridor_id = corridor_data.get('id')
        name = corridor_data.get('name')
        primary_mode = corridor_data.get('primary_mode', 'danfo').lower()

        # Map mode strings to valid choices
        mode_map = {
            'danfo': 'danfo',
            'keke': 'keke',
            'okada': 'okada',
            'walk': 'walk',
            'ferry': 'ferry',
            'brt': 'brt',
            'danfo / brt': 'mixed',
            'bus': 'danfo',
            'regulated bus (lagbus / lbsl)': 'brt',
        }
        
        primary_mode = mode_map.get(primary_mode.lower(), 'mixed')

        try:
            corridor, created = Corridor.objects.update_or_create(
                corridor_id=corridor_id,
                defaults={
                    'name': name,
                    'primary_mode': primary_mode,
                    'city': city,
                    'description': '',
                    'notes': corridor_data.get('notes', ''),
                    'is_active': True,
                }
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"{action} corridor: {corridor_id} - {name}")
            return corridor
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error creating corridor {corridor_id}: {str(e)}"))
            return None

    def _create_corridor_stops(self, corridor, stops_data):
        """Create transport stops and add them to the corridor"""
        for sequence, stop_data in enumerate(stops_data, start=1):
            stop_name = stop_data.get('name')
            stop_type = stop_data.get('type', 'bus_stop').lower()

            # Map stop type strings
            type_map = {
                'major park': 'major_park',
                'bus stop': 'bus_stop',
                'major interchange': 'major_interchange',
                'major bus stop': 'major_bus_stop',
                'station': 'terminal',
                'terminal': 'terminal',
                'major terminal': 'major_terminal',
                'junction': 'junction',
                'major junction': 'major_junction',
            }
            
            stop_type = type_map.get(stop_type.lower(), 'bus_stop')

            try:
                # Get or create the transport stop
                transport_stop, created = TransportStop.objects.get_or_create(
                    name=stop_name,
                    city=corridor.city,
                    defaults={
                        'stop_type': 'bus',  # Use generic type in TransportStop
                        'landmark': '',
                        'address': '',
                        'is_verified': False,
                    }
                )
                
                # Create the corridor stop relationship
                corridor_stop, created = CorridorStop.objects.update_or_create(
                    corridor=corridor,
                    sequence=sequence,
                    defaults={
                        'stop': transport_stop,
                        'stop_type': stop_type,
                        'estimated_time_from_previous': 0,
                    }
                )
                
                if created:
                    self.stdout.write(f"  └─ Stop {sequence}: {stop_name} ({stop_type})")
                    
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f"  └─ Error adding stop {stop_name}: {str(e)}")
                )

    def _create_connections(self, corridor, stops_data):
        """Create inter-stop connections based on the 'connections' field"""
        stop_map = {}
        
        # Build a map of stop names to TransportStop objects
        for stop_data in stops_data:
            stop_name = stop_data.get('name')
            try:
                transport_stop = TransportStop.objects.get(
                    name=stop_name,
                    city=corridor.city
                )
                stop_map[stop_name] = transport_stop
            except TransportStop.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f"  └─ Could not find stop: {stop_name}")
                )

        # Process connections for each stop
        for stop_data in stops_data:
            from_stop_name = stop_data.get('name')
            connections = stop_data.get('connections', [])

            if not connections or from_stop_name not in stop_map:
                continue

            from_stop = stop_map[from_stop_name]

            for connection_str in connections:
                # Parse connection string: "Keke to Sabo" -> mode='keke', destination='Sabo'
                try:
                    parts = connection_str.split(' to ')
                    if len(parts) != 2:
                        continue

                    mode_str = parts[0].strip().lower()
                    to_stop_name = parts[1].strip()

                    # Map mode strings
                    mode_map = {
                        'keke': 'keke',
                        'okada': 'okada',
                        'danfo': 'danfo',
                        'ferry': 'ferry',
                        'bus': 'danfo',
                        'brt': 'brt',
                    }

                    transport_mode = mode_map.get(mode_str, 'keke')

                    if to_stop_name in stop_map:
                        to_stop = stop_map[to_stop_name]
                        
                        # Create the connection
                        connection, created = StopConnection.objects.update_or_create(
                            from_stop=from_stop,
                            to_stop=to_stop,
                            transport_mode=transport_mode,
                            defaults={
                                'corridor': corridor,
                                'estimated_time_minutes': 10,
                                'is_verified': True,
                            }
                        )

                        if created:
                            self.stdout.write(
                                f"  └─ Connection: {from_stop_name} → {to_stop_name} ({transport_mode})"
                            )

                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f"  └─ Error processing connection '{connection_str}': {str(e)}")
                    )
