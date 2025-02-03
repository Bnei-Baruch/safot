import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from "react-router-dom";
import { Box, Button } from "@mui/material";

import { fetchSegments, Segment } from '../SegmentSlice';
import { fetchSource, addSource } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';
import SegmentBox from '../cmp/SegmentBox';
import AddSourceDialog from '../cmp/AddSourceDialog';
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
	const [dialogOpen, setDialogOpen] = useState(false);

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

	const handleOpenDialog = () => setDialogOpen(true);
	const handleCloseDialog = () => setDialogOpen(false);

	const handleAddTranslation = async (data: any) => {
		if (!parsedId) return; // Ensure we have a valid parent source ID

		const newSourceData = {
			...data,
			original_source_id: parsedId, // Attach the original source ID
		};

		try {
			const addedSource = await dispatch(addSource(newSourceData)).unwrap();

			if (!addedSource.id) {
				throw new Error('Failed to create translation');
			}

			showToast('Translation created successfully!', 'success');
			handleCloseDialog(); // Close the dialog after success
		} catch (error) {
			console.error('Error creating translation:', error);
			showToast('Failed to create translation. Please try again.', 'error');
		}
	};

	return (
		<div>
			<h1>{parsedId && sources && JSON.stringify(sources[parsedId])}</h1>
			<Button
				variant="contained"
				color="secondary"
				onClick={handleOpenDialog}
				style={{ marginBottom: '20px' }}
			>
				Add New Translation
			</Button>
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
			{dialogOpen && (
				<AddSourceDialog
					open={dialogOpen}
					onClose={handleCloseDialog}
					onSubmit={handleAddTranslation}
					mode="translation"
				/>
			)}
		</div>
	)
}

export default SourceEdit;
