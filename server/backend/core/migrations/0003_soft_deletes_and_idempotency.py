from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_corridor_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='userreport',
            name='idempotency_key',
            field=models.CharField(blank=True, db_index=True, max_length=100),
        ),
        migrations.AddField(
            model_name='userreport',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='userfavoriteplace',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name='userreport',
            index=models.Index(fields=['deleted_at'], name='core_userreport_deleted_idx'),
        ),
        migrations.AddIndex(
            model_name='userfavoriteplace',
            index=models.Index(fields=['deleted_at'], name='core_userfav_deleted_idx'),
        ),
    ]
