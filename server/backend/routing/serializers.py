from rest_framework import serializers

LAGOS_LAT_MIN, LAGOS_LAT_MAX = 6.2, 6.8
LAGOS_LNG_MIN, LAGOS_LNG_MAX = 2.9, 3.8

VALID_MODES = ('walk', 'keke', 'okada', 'danfo', 'brt', 'ferry', 'rail', 'uber', 'bolt')


class CoordinateSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    name = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')

    def validate_latitude(self, value):
        if not (-90 <= value <= 90):
            raise serializers.ValidationError('Latitude must be between -90 and 90.')
        return value

    def validate_longitude(self, value):
        if not (-180 <= value <= 180):
            raise serializers.ValidationError('Longitude must be between -180 and 180.')
        return value


class AvoidPointSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    radius_km = serializers.FloatField(min_value=0.05, max_value=10.0)


class RouteComputeRequestSerializer(serializers.Serializer):
    origin = CoordinateSerializer()
    destination = CoordinateSerializer()
    preferred_first_leg_mode = serializers.ChoiceField(choices=VALID_MODES, required=False, allow_null=True, default=None)
    avoid_points = AvoidPointSerializer(many=True, required=False, default=list)

    def _validate_in_lagos(self, value, label):
        lat, lng = value['latitude'], value['longitude']
        if not (LAGOS_LAT_MIN <= lat <= LAGOS_LAT_MAX and LAGOS_LNG_MIN <= lng <= LAGOS_LNG_MAX):
            raise serializers.ValidationError(
                f'{label} coordinates appear to be outside Lagos '
                f'(lat {LAGOS_LAT_MIN}–{LAGOS_LAT_MAX}, lng {LAGOS_LNG_MIN}–{LAGOS_LNG_MAX}).'
            )
        return value

    def validate_origin(self, value):
        return self._validate_in_lagos(value, 'Origin')

    def validate_destination(self, value):
        return self._validate_in_lagos(value, 'Destination')
