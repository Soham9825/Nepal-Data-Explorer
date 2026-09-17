from django.db import migrations


def populate_email_verified(apps, schema_editor):
    CustomUser = apps.get_model('accounts', 'CustomUser')
    CustomUser.objects.filter(is_verified=True).update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_customuser_email_verified_emailverificationtoken'),
    ]

    operations = [
        migrations.RunPython(populate_email_verified, migrations.RunPython.noop),
    ]