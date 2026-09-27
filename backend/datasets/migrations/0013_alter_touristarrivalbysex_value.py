from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("datasets", "0012_provincetourismvisit_national_arrivals"),
    ]

    operations = [
        migrations.AlterField(
            model_name="touristarrivalbysex",
            name="value",
            field=models.DecimalField(decimal_places=2, max_digits=12),
        ),
    ]
