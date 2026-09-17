from rest_framework import serializers


class DashboardStateSerializer(serializers.Serializer):
    """Validates the dashboard state submitted by the frontend.

    The frontend only echoes the filters/indicators its dashboard actually
    has. All fields are optional so the backend can generate a default
    report even when the UI exposes no filters.
    """

    fiscal_year = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    selected_indicators = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    selected_province = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, default=None
    )
    filters = serializers.DictField(required=False, default=dict)
    year_range = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )
    category = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    indicator = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    active_tab = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    arrival_range = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    revenue_range = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    include_all_source_markets = serializers.BooleanField(required=False, default=False)
    range = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")
    year = serializers.CharField(required=False, allow_blank=True, allow_null=True, default="")