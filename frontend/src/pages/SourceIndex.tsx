import React, { useEffect, useState, useMemo } from 'react';
import { useKeycloak } from '@react-keycloak/web';
import { Box, Typography, Container } from '@mui/material';

import { useAppDispatch, useAppSelector, RootState } from '../store/store';
import { fetchSources } from '../store/SourceSlice';
import SourceTable from '../cmp/SourceTable';
import SourceFilter from '../cmp/SourceFilter';
import { SourcePair, FilterType } from '../types/frontend-types';

const PREFERRED_FILTER = 'preferred_filter';

const SourceIndex: React.FC = () => {
  const { keycloak } = useKeycloak();
  const dispatch = useAppDispatch();
  const { sources, loading, error } = useAppSelector((state: RootState) => state.sources);

  const [filterType, setFilterType] = useState<FilterType>(localStorage.getItem(PREFERRED_FILTER) as FilterType || 'mine');
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [fileNameFilter, setFileNameFilter] = useState<string>('');
  const [fromLanguageFilter, setFromLanguageFilter] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchSources());
  }, [dispatch]);

  const sourcePairs = useMemo<SourcePair[]>(() => {
    return Object.values(sources)
      .filter(translated => !!translated.original_source_id)
      .map(translated => {
        const original = Object.values(sources).find(original => original.id === translated.original_source_id) || null;
        return { original, translated };
      // Type inference don't understand original is not null, assert via "pair is SourcePair"
      }).filter((pair): pair is SourcePair => pair.original !== null);
  }, [sources]);

  const filteredSourcePairs = useMemo<SourcePair[]>(() => {
    return sourcePairs.filter(pair => {
      if (filterType === 'mine') {
        return pair.original.username === keycloak.tokenParsed?.preferred_username;
      }

      if (filterType === 'file') {
        return pair.original.name.toLowerCase().includes(fileNameFilter.toLowerCase());
      }

      if (filterType === 'language') {
        return !languageFilter || pair.translated?.language === languageFilter;
      }
      if (filterType === 'from_language') {
        return !fromLanguageFilter || pair.original.language === fromLanguageFilter;
      }

      return true; // 'none'
    });
  }, [sourcePairs, filterType, fileNameFilter, languageFilter, fromLanguageFilter, keycloak.tokenParsed]);

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
        {!loading && !error && <SourceTable pairs={filteredSourcePairs} />}
      </Box>
    </Container>
  );
};

export default SourceIndex;
