from django import forms

class RunTestValidationForm(forms.Form):
    department = forms.CharField(max_length=100)
    app = forms.CharField(max_length=100)
    feature = forms.CharField(max_length=100)
    environment = forms.CharField(max_length=100)
    feature_id = forms.IntegerField()
    feature_result_id = forms.IntegerField()

class SetScheduleValidationForm(forms.Form):
    department = forms.CharField(max_length=100)
    app = forms.CharField(max_length=100)
    feature = forms.CharField(max_length=100)
    schedule = forms.CharField(max_length=20)