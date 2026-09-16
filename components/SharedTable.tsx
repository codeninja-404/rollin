'use client';

import React from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';

/**
 * SharedTable — A consistent wrapper around Ant Design's Table.
 * Enforces the project's flat, sharp-edged design system and centered pagination.
 *
 * Usage: Drop-in replacement for <Table /> with sensible defaults.
 */
export default function SharedTable<T extends object>(props: TableProps<T>) {
  const {
    size = 'small',
    pagination,
    style,
    ...rest
  } = props;

  // Merge pagination defaults (centered, sharp)
  const mergedPagination =
    pagination === false
      ? false
      : {
          pageSize: 15,
          showSizeChanger: true,
          pageSizeOptions: ['15', '30', '50'],
          ...((pagination && typeof pagination === 'object') ? pagination : {}),
          style: {
            display: 'flex',
            justifyContent: 'center',
            padding: '10px 16px',
            margin: 0,
            ...((pagination && typeof pagination === 'object' && pagination.style) ? pagination.style : {}),
          },
        };

  return (
    <Table<T>
      size={size}
      pagination={mergedPagination}
      style={{ background: 'transparent', ...style }}
      {...rest}
    />
  );
}
