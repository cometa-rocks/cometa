from django.db import models

class IntegerRangeField(models.IntegerField):
    def __init__(self, verbose_name=None, name=None, min_value=None, max_value=None, **kwargs):
        self.min_value, self.max_value = min_value, max_value
        models.IntegerField.__init__(self, verbose_name, name, **kwargs)
    def formfield(self, **kwargs):
        defaults = {'min_value': self.min_value, 'max_value':self.max_value}
        defaults.update(kwargs)
        return super(IntegerRangeField, self).formfield(**defaults)

class Tests(models.Model):
    id: models.PositiveIntegerField(primary_key=True)
    app = models.CharField(max_length=100)
    environment = models.CharField(max_length=10)
    date = models.DateTimeField()
    total = models.IntegerField()
    fails = models.IntegerField()
    ok = models.IntegerField()
    skipped = models.IntegerField()
    execution_time = models.FloatField()
    pixel_diff = models.PositiveIntegerField()
    success_rate = fields.IntegerRangeField(min_value=0, max_value=100)

class Features(models.Model):
    id: models.PositiveIntegerField(primary_key=True)
    test_id: models.ForeignKey('Tests', on_delete=models.CASCADE)
    name2 = models.CharField(max_length=100)
    steps = models.PositiveIntegerField()
    ok = models.BooleanField()
    execut  ion_time = models.FloatField()
    pixel_diff = models.PositiveIntegerField()

class Steps(models.Model):
    id: models.PositiveIntegerField(primary_key=True)
    feature_id: models.ForeignKey('Features', on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    execution_time = models.FloatField()
    pixel_diff2 = models.PositiveIntegerField()



