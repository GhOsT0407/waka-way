# Generated migration for Corridor, CorridorStop, and StopConnection models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Corridor',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('corridor_id', models.CharField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=250)),
                ('description', models.TextField(blank=True)),
                ('primary_mode', models.CharField(
                    choices=[
                        ('danfo', 'Danfo/Minibus'),
                        ('brt', 'BRT (Bus Rapid Transit)'),
                        ('keke', 'Keke/Tricycle'),
                        ('okada', 'Okada/Motorcycle'),
                        ('ferry', 'Ferry'),
                        ('walk', 'Walking'),
                        ('mixed', 'Mixed Modes'),
                    ],
                    max_length=20
                )),
                ('is_active', models.BooleanField(default=True)),
                ('operating_hours_start', models.TimeField(blank=True, null=True)),
                ('operating_hours_end', models.TimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('city', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='corridors', to='core.city')),
            ],
            options={
                'verbose_name_plural': 'Corridors',
            },
        ),
        migrations.CreateModel(
            name='CorridorStop',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sequence', models.IntegerField()),
                ('stop_type', models.CharField(
                    choices=[
                        ('major_park', 'Major Park'),
                        ('major_interchange', 'Major Interchange'),
                        ('bus_stop', 'Bus Stop'),
                        ('major_bus_stop', 'Major Bus Stop'),
                        ('junction', 'Junction'),
                        ('major_junction', 'Major Junction'),
                        ('terminal', 'Terminal'),
                        ('major_terminal', 'Major Terminal'),
                    ],
                    max_length=20
                )),
                ('estimated_time_from_previous', models.IntegerField(default=0, help_text='Estimated travel time from previous stop in minutes')),
                ('corridor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='corridor_stops', to='core.corridor')),
                ('stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='corridor_positions', to='core.transportstop')),
            ],
            options={
                'ordering': ['corridor', 'sequence'],
            },
        ),
        migrations.CreateModel(
            name='StopConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('transport_mode', models.CharField(
                    choices=[
                        ('danfo', 'Danfo/Minibus'),
                        ('brt', 'BRT'),
                        ('keke', 'Keke/Tricycle'),
                        ('okada', 'Okada/Motorcycle'),
                        ('ferry', 'Ferry'),
                        ('walk', 'Walking'),
                    ],
                    max_length=20
                )),
                ('estimated_time_minutes', models.IntegerField(default=5)),
                ('distance_km', models.FloatField(default=0.0)),
                ('is_verified', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('corridor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='connections', to='core.corridor')),
                ('from_stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='connections_from', to='core.transportstop')),
                ('to_stop', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='connections_to', to='core.transportstop')),
            ],
        ),
        migrations.AddIndex(
            model_name='stopconnection',
            index=models.Index(fields=['from_stop', 'transport_mode'], name='core_stopco_from_st_idx'),
        ),
        migrations.AddIndex(
            model_name='stopconnection',
            index=models.Index(fields=['corridor'], name='core_stopco_corridor_idx'),
        ),
        migrations.AddConstraint(
            model_name='stopconnection',
            constraint=models.UniqueConstraint(fields=['from_stop', 'to_stop', 'transport_mode'], name='unique_connection'),
        ),
        migrations.AddIndex(
            model_name='corridorstop',
            index=models.Index(fields=['corridor', 'sequence'], name='core_corridors_sequence_idx'),
        ),
        migrations.AddConstraint(
            model_name='corridorstop',
            constraint=models.UniqueConstraint(fields=['corridor', 'sequence'], name='unique_corridor_sequence'),
        ),
        migrations.AddIndex(
            model_name='corridor',
            index=models.Index(fields=['city', 'primary_mode'], name='core_corridor_mode_idx'),
        ),
        migrations.AddIndex(
            model_name='corridor',
            index=models.Index(fields=['is_active'], name='core_corridor_active_idx'),
        ),
    ]
