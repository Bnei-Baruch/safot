import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSources } from '../SourceSlice';
import { RootState } from '../store';

const SourceIndex: React.FC = () => {
    const dispatch = useDispatch();
    const { sources, status, error } = useSelector((state: RootState) => state.sources);

    useEffect(() => {
        dispatch(fetchSources());
    }, [dispatch]);

    return (
        <div className="source-index">
            <h1>Source Index CMP</h1>

            {status === 'loading' && <p>Loading...</p>}
            {status === 'failed' && <p>Error: {error}</p>}
            {status === 'succeeded' && (
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
