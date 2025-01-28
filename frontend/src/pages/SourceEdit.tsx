import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from "react-router-dom";
import { Box } from "@mui/material";

import { fetchSegments, Segment } from '../SegmentSlice';
import { fetchSource } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';
import SegmentBox from '../cmp/SegmentBox';
import { useToast } from '../cmp/Toast';

const SourceEdit: React.FC = () => {
	const dispatch = useAppDispatch();
	const { showToast } = useToast();

	const { id } = useParams<{ id: string }>();
	const parsedId = id ? parseInt(id, 10) : undefined;
	const { segments, loading: segmentsLoading, error: segmentsError } =
		useSelector((state: RootState) => state.segments);
	const { sources, loading: sourcesLoading, error: sourcesError } =
		useSelector((state: RootState) => state.sources);

	useEffect(() => {
		// Fetch segments if they are missing or empty for the given source_id, 
		// ensuring we don't re-fetch if already loaded.
		if (parsedId && !segments[parsedId]?.length && !segmentsLoading && !segmentsError) {
			dispatch(fetchSegments({ source_id: parsedId }));
		}
		if (segmentsError) {
			showToast(segmentsError, 'error');
		}
	}, [dispatch, parsedId, showToast, segmentsLoading, segmentsError, segments]);

	useEffect(() => {
		if (parsedId && !(parsedId in sources) && !sourcesLoading && !sourcesError) {
			dispatch(fetchSource({ id: parsedId }));
		}
		if (sourcesError) {
			showToast(sourcesError, 'error');
		}
	}, [dispatch, parsedId, sources, sourcesLoading, sourcesError]);

	return (
		<div>
			<h1>{parsedId && sources && JSON.stringify(sources[parsedId])}</h1>
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
				}}
			>
				{parsedId !== undefined && parsedId in segments && segments[parsedId].map((segment: Segment) => (
					<SegmentBox key={segment.id} segment={segment} />
				))}
			</Box>
		</div>
	)
}

export default SourceEdit;
