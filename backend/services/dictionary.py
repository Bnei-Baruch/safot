from peewee import (
    fn,
)

from models import (
    Dictionaries,
    Rules,
)

from services.utils import (
    microseconds,
)

def get_dictionaries(dictionary_id: int | None = None, dictionary_timestamp: int | None = None) -> list[dict]:
    D = Dictionaries
    MIN_MAX = (
        D
        .select(
            D.id,
            fn.MIN(D.timestamp).alias('created_at'),
            fn.MAX(D.timestamp).alias('modified_at'),
        )
        .group_by(D.id)
    ).alias('MIN_MAX')
    if dictionary_id is not None:
        MIN_MAX = MIN_MAX.where(D.id == dictionary_id)
    if dictionary_timestamp is not None:
        MIN_MAX = MIN_MAX.where(microseconds(D.timestamp) <= dictionary_timestamp)

    D_CREATED_AT = D.alias('D_CREATED_AT')
    D_MODIFIED_AT = D.alias('D_MODIFIED_AT')

    query = (D_CREATED_AT
         .select(
             D_MODIFIED_AT,
             microseconds(D_MODIFIED_AT.timestamp, 'timestamp_epoch'),
             microseconds(MIN_MAX.c.created_at, 'created_at_epoch'),
             D_CREATED_AT.username.alias('created_by'),
             microseconds(MIN_MAX.c.modified_at, 'modified_at_epoch'),
             D_MODIFIED_AT.username.alias('modified_by'),
         )
         .join(MIN_MAX, on=((D_CREATED_AT.id == MIN_MAX.c.id) &
                        (D_CREATED_AT.timestamp == MIN_MAX.c.created_at)))
         .switch(D_CREATED_AT)
         .join(D_MODIFIED_AT, on=((D_MODIFIED_AT.id == MIN_MAX.c.id) &
                       (D_MODIFIED_AT.timestamp == MIN_MAX.c.modified_at)))
         .order_by(MIN_MAX.c.id)
    )
    if dictionary_id is not None:
        query = query.where(D_CREATED_AT.id == dictionary_id)
    if dictionary_timestamp is not None:
        query = query.where(microseconds(D_CREATED_AT.timestamp) <= dictionary_timestamp)
    return list(query.dicts())

def get_rules(dictionary_id: int | None = None, dictionary_timestamp: int | None = None, rule_id: int | None = None) -> list[dict]:
	R = Rules
		
	MIN_MAX = (R
		.select(
			R.id,
			fn.MIN(R.timestamp).alias('created_at'),
			fn.MAX(R.timestamp).alias('modified_at'),
		)
		.group_by(R.id)
	).alias('MIN_MAX')
	if dictionary_id is not None:
		MIN_MAX = MIN_MAX.where(R.dictionary_id == dictionary_id)
	if dictionary_timestamp is not None:
		MIN_MAX = MIN_MAX.where(microseconds(R.timestamp) <= dictionary_timestamp)
	if rule_id is not None:
		MIN_MAX = MIN_MAX.where(R.id == rule_id)

	R_CREATED_AT = R.alias('R_CREATED_AT')
	R_MODIFIED_AT = R.alias('R_MODIFIED_AT')

	query = (R_CREATED_AT
		 .select(
			 R_MODIFIED_AT,
			 microseconds(R_MODIFIED_AT.timestamp, 'timestamp_epoch'),
			 microseconds(MIN_MAX.c.created_at, 'created_at_epoch'),
			 R_CREATED_AT.username.alias('created_by'),
			 microseconds(MIN_MAX.c.modified_at, 'modified_at_epoch'),
			 R_MODIFIED_AT.username.alias('modified_by'),
		 )
		 .join(MIN_MAX, on=((R_CREATED_AT.id == MIN_MAX.c.id) &
						(R_CREATED_AT.timestamp == MIN_MAX.c.created_at)))
		 .switch(R_CREATED_AT)
		 .join(R_MODIFIED_AT, on=((R_MODIFIED_AT.id == MIN_MAX.c.id) &
					   (R_MODIFIED_AT.timestamp == MIN_MAX.c.modified_at)))
		 .order_by(R_MODIFIED_AT.order)
	)
	if dictionary_id is not None:
		query = query.where(R_CREATED_AT.dictionary_id == dictionary_id)
	if dictionary_timestamp is not None:
		query = query.where(microseconds(R_CREATED_AT.timestamp) <= dictionary_timestamp)
	if rule_id is not None:
		query = query.where(R_CREATED_AT.id == rule_id)
	return list(query.dicts())
