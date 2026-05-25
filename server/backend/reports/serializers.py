from rest_framework import serializers
from core.models import UserReport


class UserReportSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(
        source='get_report_type_display',
        read_only=True,
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True,
    )

    class Meta:
        model = UserReport
        fields = [
            'id', 'report_type', 'report_type_display',
            'route', 'stop', 'fare',
            'title', 'description',
            'new_fare_ngn',
            'status', 'status_display', 'upvotes', 'downvotes',
            'created_at',
        ]
        read_only_fields = ['status', 'upvotes', 'downvotes', 'created_at']


class CreateReportSerializer(serializers.Serializer):
    report_type = serializers.ChoiceField(choices=UserReport.REPORT_TYPES)
    title = serializers.CharField(max_length=200)
    description = serializers.CharField()
    route = serializers.IntegerField(required=False, allow_null=True)
    stop = serializers.IntegerField(required=False, allow_null=True)
    fare = serializers.IntegerField(required=False, allow_null=True)
    new_fare_ngn = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    user_device_id = serializers.CharField(max_length=200, required=False, default='')

    def validate(self, data):
        if data.get('report_type') == 'fare_update' and not data.get('new_fare_ngn'):
            raise serializers.ValidationError(
                {'new_fare_ngn': 'Required when report_type is fare_update'}
            )
        return data
