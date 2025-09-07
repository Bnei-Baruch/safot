from datetime import datetime, timedelta, timezone
from peewee import (
    DateTimeField,
    fn,
)

def apply_dict(model_instance, data: dict, logger = None):
    for name, field in model_instance._meta.fields.items():
        if name in data:
            if logger:
                logger.info('Field: %s %s', field, type(field))
                logger.info('data[field]: %s %s', data[name], type(data[name]))
            if isinstance(field, DateTimeField) and isinstance(data[name], int) and not isinstance(data[name], bool):
                dt = (datetime(1970, 1, 1, tzinfo=timezone.utc) +
                    timedelta(microseconds=data[name])).replace(tzinfo=None)
                setattr(model_instance, name, dt)
            else:
                setattr(model_instance, name, data[name])

def microseconds(field, alias = ''):
    epoch = (fn.date_part('epoch', fn.timezone('UTC', field)) * 1000000).cast('bigint')
    if alias:
        epoch = epoch.alias(alias)
    return epoch

def epoch_microseconds(dt: datetime) -> int:
    # treat naive datetimes as UTC; adjust if you want localtime instead
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)

    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    delta = dt - epoch
    return delta // timedelta(microseconds=1)  # exact integer µs
