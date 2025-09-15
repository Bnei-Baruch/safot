import React, { memo } from 'react';
import {
  TextField,
  InputAdornment,
  Box
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface UserSearchProps {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const UserSearch: React.FC<UserSearchProps> = memo(({
  value,
  onChange,
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <TextField
        fullWidth
        placeholder="Search users by name, email, or username..."
        value={value}
        onChange={onChange}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{ maxWidth: 600 }}
      />
    </Box>
  );
});

UserSearch.displayName = 'UserSearch';

export default UserSearch;
