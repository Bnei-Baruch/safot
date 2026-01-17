import React, { useEffect, useState, useMemo } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Box, Typography, Container } from '@mui/material';

import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { fetchSources, fetchSourceRelations } from '../store/SourceSlice';
import SourceTable from '../cmp/SourceTable';
import SourceFilter from '../cmp/SourceFilter';
import { SourceTuple, FilterType } from '../types/frontend-types';

const PREFERRED_FILTER = 'preferred_filter';

const SourceIndex: React.FC = () => {
  const { keycloak } = useKeycloak();
  const dispatch = useAppDispatch();
  const { sources, relations, loading, error } = useAppSelector((state: RootState) => state.sources);

  const [filterType, setFilterType] = useState<FilterType>(localStorage.getItem(PREFERRED_FILTER) as FilterType || 'mine');
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [fileNameFilter, setFileNameFilter] = useState<string>('');
  const [fromLanguageFilter, setFromLanguageFilter] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchSources());
  }, [dispatch]);

  useEffect(() => {
    // Fetch relations for all sources
    const sourceIds = Object.keys(sources).map(Number);
    if (sourceIds.length > 0) {
      dispatch(fetchSourceRelations(sourceIds));
    }
  }, [dispatch, sources]);

  const sourceTuples = useMemo<SourceTuple[]>(() => {
    // Find all translated sources (those that have origins in relations)
    return Object.values(sources)
      .filter(translated => relations[translated.id]?.origins && relations[translated.id].origins.length > 0)
      .map(translated => {
        const originIds = relations[translated.id].origins;
        const originSources = originIds
          .map(id => sources[id])
          .filter(s => s !== undefined);

        // Find the original source (with is_original: true)
        const originalSource = originSources.find(s => s.properties?.is_original === true);
        // Find additional sources (without is_original: true)
        const additionalSources = originSources.filter(s => s.properties?.is_original !== true);

        return originalSource ? { originalSource, additionalSources, translated } : null;
      })
      .filter((tuple): tuple is SourceTuple => tuple !== null);
  }, [sources, relations]);

  const filteredSourceTuples = useMemo<SourceTuple[]>(() => {
    return sourceTuples.filter(tuple => {
      if (filterType === 'mine') {
        return tuple.originalSource.username === keycloak.tokenParsed?.preferred_username;
      }

      if (filterType === 'file') {
        return tuple.originalSource.name.toLowerCase().includes(fileNameFilter.toLowerCase());
      }

      if (filterType === 'language') {
        return !languageFilter || tuple.translated?.language === languageFilter;
      }
      if (filterType === 'from_language') {
        // Check if any of the source languages match the filter
        const allLanguages = [tuple.originalSource.language, ...tuple.additionalSources.map(s => s.language)];
        return !fromLanguageFilter || allLanguages.includes(fromLanguageFilter);
      }

      return true; // 'none'
    });
  }, [sourceTuples, filterType, fileNameFilter, languageFilter, fromLanguageFilter, keycloak.tokenParsed]);

  return (
    <Container maxWidth="xl" sx={{ position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: -30, right: 30 }}>
        <SourceFilter
          filterType={filterType}
          setFilterType={(f) => {
            localStorage.setItem(PREFERRED_FILTER, f);
            setFilterType(f);
          }}
          languageFilter={languageFilter}
          setLanguageFilter={setLanguageFilter}
          fileNameFilter={fileNameFilter}
          setFileNameFilter={setFileNameFilter}
          fromLanguageFilter={fromLanguageFilter}
          setFromLanguageFilter={setFromLanguageFilter}
        />
      </Box>
      <Box>
        {loading && <Typography>Loading...</Typography>}
        {error && <Typography color="error">Error: {error}</Typography>}
        {!loading && !error && <SourceTable tuples={filteredSourceTuples} />}
      </Box>
    </Container>
  );
};

export default SourceIndex;
