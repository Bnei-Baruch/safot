import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { fetchSources } from '../SourceSlice';
import { useAppDispatch, RootState } from '../store';


const SourceIndex: React.FC = () => {
    const dispatch = useAppDispatch();
    const { sources, loading, error } = useSelector((state: RootState) => state.sources);

    useEffect(() => {
        dispatch(fetchSources());
    }, [dispatch]);

    return (
        <div className="source-index">
            <h1>Source Index CMP</h1>

            {loading && <p>Loading...</p>}
            {error && <p>Error: {error}</p>}
            {!loading && !error && (
                <ul>
                    {sources.map((source) => (
                        <li key={source.id}>
                            {source.name} - {source.language}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SourceIndex;
