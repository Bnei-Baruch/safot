import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from "react-router-dom";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button } from "@mui/material";
import { fetchSegments, addSegment, Segment } from '../SegmentSlice';
import { fetchSource } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';
import { useToast } from '../cmp/Toast';

const SourceEdit: React.FC = () => {
    const dispatch = useAppDispatch();
    const { showToast } = useToast();
    const { id } = useParams<{ id: string }>();
    const parsedId = id ? parseInt(id, 10) : undefined;

    const { segments, loading: segmentsLoading, error: segmentsError } = useSelector((state: RootState) => state.segments);
    const { sources, loading: sourcesLoading, error: sourcesError } = useSelector((state: RootState) => state.sources);

    const sourceData = parsedId ? sources[parsedId] : undefined;
    const originalSourceId = sourceData?.original_source_id;

    const [translations, setTranslations] = useState<{ 
        [key: number]: { 
            text: string; 
            order: number;
            original_segment_id: number; 
            original_segment_timestamp: string; 
        } 
    }>({});

    useEffect(() => {
        if (parsedId && !(parsedId in sources)) {
            dispatch(fetchSource({ id: parsedId }));
        }
        if (originalSourceId && !(originalSourceId in sources)) {
            dispatch(fetchSource({ id: originalSourceId }));
        }
    }, [dispatch, parsedId, originalSourceId, sources]);

    useEffect(() => {
        if (originalSourceId && !(originalSourceId in segments)) {
            dispatch(fetchSegments({ source_id: originalSourceId }));
        }
        if (parsedId && !(parsedId in segments)) {
            dispatch(fetchSegments({ source_id: parsedId }));
        }
    }, [dispatch, parsedId, originalSourceId, segments]);

    // ✅ מעדכן את הסטייט המקומי עם השינוי
    const handleTranslationChange = (segmentId: number, order: number, timestamp: string, value: string) => {
        setTranslations(prev => ({
            ...prev,
            [segmentId]: { 
                text: value, 
                order,
                original_segment_id: segmentId,  
                original_segment_timestamp: timestamp 
            }
        }));
    };

    const handleSaveTranslation = async (segmentId: number) => {
        if (!parsedId || !translations[segmentId]) return;

        const segmentToSave = {
            source_id: parsedId,  
            order: translations[segmentId].order, 
            text: translations[segmentId].text,  
            original_segment_id: translations[segmentId].original_segment_id,  
            original_segment_timestamp: translations[segmentId].original_segment_timestamp || undefined,
			properties: {
				translation_type: "user" as "user"
			}  
        };
		console.log("Sending segment data to backend:", segmentToSave);
        try {
            await dispatch(addSegment(segmentToSave)).unwrap();
            showToast("Translation saved successfully!", "success");

            setTranslations(prev => {
                const updated = { ...prev };
                delete updated[segmentId]; 
                return updated;
            });

        } catch (error) {
            console.error("Error saving translation:", error);
            showToast("Failed to save translation. Please try again.", "error");
        }
    };

    return (
        <div>
            <h1>Edit Translation - {sourceData?.name} ({sourceData?.language})</h1>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Order</TableCell>
                            <TableCell style={{ width: "40%" }}>
                                Source ({originalSourceId && sources[originalSourceId]?.language || 'Unknown'})
                            </TableCell>
                            <TableCell style={{ width: "40%" }}>Translation ({sourceData?.language})</TableCell>
                            <TableCell style={{ width: "20%" }}>Actions</TableCell>  {/* ✅ עמודה חדשה */}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {originalSourceId && segments[originalSourceId] && parsedId ? (
                            segments[originalSourceId].map((sourceSegment: Segment) => {
                                const existingTranslation = segments[parsedId]?.find(t => t.order === sourceSegment.order)?.text || '';
                                const hasChanged = (translations[sourceSegment.id]?.text ?? existingTranslation) !== existingTranslation;

                                return (
                                    <TableRow key={sourceSegment.id}>
                                        <TableCell>{sourceSegment.order}</TableCell>
                                        <TableCell>{sourceSegment.text}</TableCell>
                                        <TableCell
                                            style={{
                                                backgroundColor: hasChanged ? "#fff3cd" : "white"  // ✅ צהוב אם יש שינוי
                                            }}
                                        >
                                            <TextField
                                                fullWidth
                                                value={translations[sourceSegment.id]?.text ?? existingTranslation}
                                                onChange={(e) => handleTranslationChange(
                                                    sourceSegment.id, 
                                                    sourceSegment.order, 
                                                    sourceSegment.original_segment_timestamp ?? '',
                                                    e.target.value 
                                                )}
                                                placeholder="Enter translation"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                onClick={() => handleSaveTranslation(sourceSegment.id)}
                                                disabled={!hasChanged} // ✅ כפתור שמור מושבת אם אין שינוי
                                            >
                                                שמור
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} align="center">Loading segments...</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    );
};

export default SourceEdit;

// import React, { useEffect, useState } from 'react';
// import { useSelector } from 'react-redux';
// import { useParams } from "react-router-dom";
// import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField } from "@mui/material";
// import { fetchSegments, Segment } from '../SegmentSlice';
// import { fetchSource } from '../SourceSlice';
// import { useAppDispatch, RootState } from '../store';
// import { useToast } from '../cmp/Toast';

// const SourceEdit: React.FC = () => {
//     const dispatch = useAppDispatch();
//     const { showToast } = useToast();
//     const { id } = useParams<{ id: string }>();
//     const parsedId = id ? parseInt(id, 10) : undefined;

//     const { segments, loading: segmentsLoading, error: segmentsError } = useSelector((state: RootState) => state.segments);
//     const { sources, loading: sourcesLoading, error: sourcesError } = useSelector((state: RootState) => state.sources);

//     const sourceData = parsedId ? sources[parsedId] : undefined;
//     const originalSourceId = sourceData?.original_source_id;

//     const [translations, setTranslations] = useState<{ 
// 		[key: number]: { 
// 			text: string; 
// 			original_segment_id: number; 
// 			original_segment_timestamp: string; 
// 		} 
// 	}>({});

//     console.log("Editing source:", sourceData);
//     console.log("Original source ID:", originalSourceId);
//     console.log("Segments of original source:", segments[originalSourceId]);

   
//     useEffect(() => {
//         if (parsedId && !(parsedId in sources)) {
//             dispatch(fetchSource({ id: parsedId }));
//         }
//         if (originalSourceId && !(originalSourceId in sources)) {
//             dispatch(fetchSource({ id: originalSourceId }));
//         }
//     }, [dispatch, parsedId, originalSourceId, sources]);

   
//     useEffect(() => {
//         if (originalSourceId && !(originalSourceId in segments)) {
//             console.log("Fetching segments for original source:", originalSourceId);
//             dispatch(fetchSegments({ source_id: originalSourceId })).then((res) => {
//                 console.log("Segments response from backend (original source):", res);
//             });
//         }
//         if (parsedId && !(parsedId in segments)) {
//             console.log("Fetching segments for translation source:", parsedId);
//             dispatch(fetchSegments({ source_id: parsedId })).then((res) => {
//                 console.log("Segments response from backend (translation source):", res);
//             });
//         }
//     }, [dispatch, parsedId, originalSourceId, segments]);

// 	const handleTranslationChange = (segmentId: number, order: number, timestamp: string ,value: string) => {
// 		setTranslations(prev => ({
// 			...prev,
// 			[segmentId]: { 
// 				text: value, 
// 				original_segment_id: segmentId,  
// 				original_segment_timestamp: timestamp 
// 			}
// 		}));
// 	};
	

//     return (
//         <div>
//             <h1>Edit Translation - {sourceData?.name} ({sourceData?.language})</h1>
//             <TableContainer component={Paper}>
//                 <Table>
//                     <TableHead>
//                         <TableRow>
//                             <TableCell>Order</TableCell>
//                             <TableCell style={{ width: "50%" }}>
//                                 Source ({originalSourceId && sources[originalSourceId]?.language || 'Unknown'})
//                             </TableCell>
//                             <TableCell style={{ width: "50%" }}>Translation ({sourceData?.language})</TableCell>
//                         </TableRow>
//                     </TableHead>
//                     <TableBody>
//                         {originalSourceId && segments[originalSourceId] && parsedId && segments[parsedId] ? (
//                             segments[originalSourceId].map((sourceSegment: Segment) => {
//                                 const existingTranslation = segments[parsedId]?.find(t => t.order === sourceSegment.order)?.text || '';
//                                 return (
//                                     <TableRow key={sourceSegment.id}>
//                                         <TableCell>{sourceSegment.order}</TableCell>
//                                         <TableCell>{sourceSegment.text}</TableCell>
//                                         <TableCell>
// 										<TextField
// 											fullWidth
// 											value={translations[sourceSegment.id]?.text ?? existingTranslation}
// 											onChange={(e) => handleTranslationChange(
// 												sourceSegment.id, 
// 												sourceSegment.order, 
// 												sourceSegment.original_segment_timestamp ?? '',
// 												e.target.value 
// 											)}
// 											placeholder="Enter translation"
// 										/>
//                                         </TableCell>
//                                     </TableRow>
//                                 );
//                             })
//                         ) : (
//                             <TableRow>
//                                 <TableCell colSpan={3} align="center">Loading segments...</TableCell>
//                             </TableRow>
//                         )}
//                     </TableBody>
//                 </Table>
//             </TableContainer>
//         </div>
//     );
// };

// export default SourceEdit;


// import React, { useEffect, useState } from 'react';
// import { useSelector } from 'react-redux';
// import { useParams } from "react-router-dom";
// import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Box } from "@mui/material";

// import { fetchSegments, Segment } from '../SegmentSlice';
// import { fetchSource, addSource } from '../SourceSlice';
// import { useAppDispatch, RootState } from '../store';
// import SegmentBox from '../cmp/SegmentBox';
// import AddSourceDialog from '../cmp/AddSourceDialog';
// import { useToast } from '../cmp/Toast';

// const SourceEdit: React.FC = () => {
// 	const dispatch = useAppDispatch();
// 	const { showToast } = useToast();

// 	const { id } = useParams<{ id: string }>();
// 	const parsedId = id ? parseInt(id, 10) : undefined;
// 	const [dialogOpen, setDialogOpen] = useState(false);

//  	const [translations, setTranslations] = useState<{ [key: number]: string }>({});
// 	const { segments, loading: segmentsLoading, error: segmentsError } =
// 		useSelector((state: RootState) => state.segments);
// 	const { sources, loading: sourcesLoading, error: sourcesError } =
// 		useSelector((state: RootState) => state.sources);
	

// 	useEffect(() => {
// 		// Fetch segments if they are missing or empty for the given source_id, 
// 		// ensuring we don't re-fetch if already loaded.
// 		if (parsedId && !segments[parsedId]?.length && !segmentsLoading && !segmentsError) {
// 			dispatch(fetchSegments({ source_id: parsedId }));
// 		}
// 		if (segmentsError) {
// 			showToast(segmentsError, 'error');
// 		}
// 	}, [dispatch, parsedId, showToast, segmentsLoading, segmentsError, segments]);

// 	useEffect(() => {
// 		if (parsedId && !(parsedId in sources) && !sourcesLoading && !sourcesError) {
// 			dispatch(fetchSource({ id: parsedId }));
// 		}
// 		if (sourcesError) {
// 			showToast(sourcesError, 'error');
// 		}
// 	}, [dispatch, parsedId, sources, sourcesLoading, sourcesError]);

// 	const handleOpenDialog = () => setDialogOpen(true);
// 	const handleCloseDialog = () => setDialogOpen(false);

// 	const handleAddTranslation = async (data: any) => {
// 		if (!parsedId) return; // Ensure we have a valid parent source ID

// 		const newSourceData = {
// 			...data,
// 			original_source_id: parsedId, // Attach the original source ID
// 		};
	
// 	const handleTranslationChange = (segmentId: number, value: string) => {
// 		setTranslations(prev => ({ ...prev, [segmentId]: value }));
// 	};

// 		try {
// 			const addedSource = await dispatch(addSource(newSourceData)).unwrap();

// 			if (!addedSource.id) {
// 				throw new Error('Failed to create translation');
// 			}

// 			showToast('Translation created successfully!', 'success');
// 			handleCloseDialog(); // Close the dialog after success
// 		} catch (error) {
// 			console.error('Error creating translation:', error);
// 			showToast('Failed to create translation. Please try again.', 'error');
// 		}
// 	};

// 	return (
// 		<div>
// 			<h1>{parsedId && sources && JSON.stringify(sources[parsedId])}</h1>
// 			<Button
// 				variant="contained"
// 				color="secondary"
// 				onClick={handleOpenDialog}
// 				style={{ marginBottom: '20px' }}
// 			>
// 				Add New Translation
// 			</Button>
// 			<TableContainer component={Paper}>
// 				<Table>
// 					<TableHead>
// 						<TableRow>
// 							<TableCell>Order</TableCell>
// 							<TableCell>Original</TableCell>
// 							<TableCell>Translation</TableCell>
// 						</TableRow>
// 					</TableHead>
// 					<TableBody>
// 						{parsedId !== undefined && parsedId in segments && segments[parsedId].map((segment: Segment) => (
// 							<TableRow key={segment.id}>
// 								<TableCell>{segment.order}</TableCell>
// 								<TableCell>{segment.text}</TableCell>
// 								<TableCell>{segment.order}</TableCell>
// 							</TableRow>
			
							
							
// 						))}
// 					</TableBody>
// 				</Table>
// 			</TableContainer>

// 			{/* <Box
// 				sx={{
// 					display: "flex",
// 					flexDirection: "column",
// 				}}
// 			>
// 				{parsedId !== undefined && parsedId in segments && segments[parsedId].map((segment: Segment) => (
// 					<SegmentBox key={segment.id} segment={segment} />
// 				))}
// 			</Box> */}
// 			{dialogOpen && (
// 				<AddSourceDialog
// 					open={dialogOpen}
// 					onClose={handleCloseDialog}
// 					onSubmit={handleAddTranslation}
// 					mode="translation"
// 				/>
// 			)}
// 		</div>
// 	)
// }

// export default SourceEdit;
