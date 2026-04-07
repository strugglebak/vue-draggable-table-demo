const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));

const initialDatabase = {
  rowList: [
    { id: 'row-1', label: 'Row A', sort: 1, locked: false },
    { id: 'row-2', label: 'Row B', sort: 2, locked: false },
    { id: 'row-3', label: 'Row C', sort: 3, locked: true },
    { id: 'row-4', label: 'Row D', sort: 4, locked: false }
  ],
  columnEntries: [
    {
      leafId: 'leaf-standalone-a',
      groupId: 'leaf-standalone-a',
      groupLabel: 'Standalone A',
      childLabel: 'Standalone A',
      metaLabel: 'Day 1',
      groupOrder: 1,
      childOrder: 1,
      columnType: 'standalone',
      enabledRowIds: ['row-1', 'row-3']
    },
    {
      leafId: 'leaf-group-b-1',
      groupId: 'group-b',
      groupLabel: 'Grouped B',
      childLabel: 'Child B1',
      metaLabel: 'Day 8',
      groupOrder: 2,
      childOrder: 1,
      columnType: 'group-child',
      enabledRowIds: ['row-2']
    },
    {
      leafId: 'leaf-group-b-2',
      groupId: 'group-b',
      groupLabel: 'Grouped B',
      childLabel: 'Child B2',
      metaLabel: 'Day 15',
      groupOrder: 2,
      childOrder: 2,
      columnType: 'group-child',
      enabledRowIds: ['row-1', 'row-4']
    },
    {
      leafId: 'leaf-empty-c',
      groupId: 'group-empty-c',
      groupLabel: 'Empty Group C',
      childLabel: '',
      metaLabel: 'No children',
      groupOrder: 3,
      childOrder: 1,
      columnType: 'group-only',
      enabledRowIds: []
    },
    {
      leafId: 'leaf-standalone-d',
      groupId: 'leaf-standalone-d',
      groupLabel: 'Standalone D',
      childLabel: 'Standalone D',
      metaLabel: 'Day 21',
      groupOrder: 4,
      childOrder: 1,
      columnType: 'standalone',
      enabledRowIds: ['row-2', 'row-4']
    },
    {
      leafId: 'leaf-group-e-1',
      groupId: 'group-e',
      groupLabel: 'Grouped E',
      childLabel: 'Child E1',
      metaLabel: 'Week 1',
      groupOrder: 5,
      childOrder: 1,
      columnType: 'group-child',
      enabledRowIds: ['row-1']
    },
    {
      leafId: 'leaf-group-e-2',
      groupId: 'group-e',
      groupLabel: 'Grouped E',
      childLabel: 'Child E2',
      metaLabel: 'Week 2',
      groupOrder: 5,
      childOrder: 2,
      columnType: 'group-child',
      enabledRowIds: ['row-3']
    }
  ]
};

let database = structuredClone(initialDatabase);

function clone(value) {
  return structuredClone(value);
}

function getOrderedRows() {
  return [...database.rowList].sort((a, b) => a.sort - b.sort);
}

function getOrderedColumns() {
  return [...database.columnEntries].sort((a, b) => {
    if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
    return a.childOrder - b.childOrder;
  });
}

function normalizeRows() {
  database.rowList = getOrderedRows().map((row, index) => ({
    ...row,
    sort: index + 1
  }));
}

function normalizeColumns() {
  const orderedColumns = getOrderedColumns();
  const groupIds = [];

  orderedColumns.forEach(column => {
    if (!groupIds.includes(column.groupId)) {
      groupIds.push(column.groupId);
    }
  });

  const nextColumns = [];

  groupIds.forEach((groupId, groupIndex) => {
    const groupColumns = orderedColumns
      .filter(column => column.groupId === groupId)
      .sort((a, b) => a.childOrder - b.childOrder)
      .map((column, childIndex) => ({
        ...column,
        groupOrder: groupIndex + 1,
        childOrder: childIndex + 1
      }));

    nextColumns.push(...groupColumns);
  });

  database.columnEntries = nextColumns;
}

function getOrderedGroupIds() {
  const result = [];
  getOrderedColumns().forEach(column => {
    if (!result.includes(column.groupId)) {
      result.push(column.groupId);
    }
  });
  return result;
}

function getColumnByLeafId(leafId) {
  return database.columnEntries.find(column => column.leafId === leafId);
}

export async function fetchMatrixData() {
  await wait();
  normalizeRows();
  normalizeColumns();
  return clone(database);
}

export async function resetDemoData() {
  await wait(50);
  database = clone(initialDatabase);
  return fetchMatrixData();
}

export async function changeRowSort({ rowId, sort }) {
  await wait();
  normalizeRows();
  const rows = getOrderedRows();
  const sourceIndex = rows.findIndex(row => row.id === rowId);
  const targetIndex = Math.max(0, Math.min(rows.length - 1, sort - 1));

  if (sourceIndex === -1) {
    throw new Error(`Row not found: ${rowId}`);
  }

  const [sourceRow] = rows.splice(sourceIndex, 1);
  rows.splice(targetIndex, 0, sourceRow);

  database.rowList = rows.map((row, index) => ({
    ...row,
    sort: index + 1
  }));

  return fetchMatrixData();
}

export async function changeChildSort({ leafId, targetLeafId, place }) {
  await wait();
  normalizeColumns();

  const sourceColumn = getColumnByLeafId(leafId);
  const targetColumn = getColumnByLeafId(targetLeafId);

  if (!sourceColumn || !targetColumn) {
    throw new Error('Missing child column');
  }

  if (sourceColumn.groupId !== targetColumn.groupId) {
    throw new Error('Child columns can only move inside the same group');
  }

  const groupColumns = getOrderedColumns().filter(
    column => column.groupId === sourceColumn.groupId
  );
  const sourceIndex = groupColumns.findIndex(column => column.leafId === leafId);
  const targetIndex = groupColumns.findIndex(
    column => column.leafId === targetLeafId
  );

  const [sourceLeaf] = groupColumns.splice(sourceIndex, 1);
  const insertIndex = place === 'before' ? targetIndex : targetIndex + 1;
  groupColumns.splice(insertIndex, 0, sourceLeaf);

  database.columnEntries = database.columnEntries.map(column => {
    if (column.groupId !== sourceColumn.groupId) {
      return column;
    }

    const nextIndex = groupColumns.findIndex(
      groupColumn => groupColumn.leafId === column.leafId
    );

    return {
      ...column,
      childOrder: nextIndex + 1
    };
  });

  return fetchMatrixData();
}

export async function changeGroupSort({ groupId, targetGroupId, place }) {
  await wait();
  normalizeColumns();

  const sourceGroups = getOrderedGroupIds();
  const sourceIndex = sourceGroups.findIndex(id => id === groupId);
  const targetIndex = sourceGroups.findIndex(id => id === targetGroupId);

  if (sourceIndex === -1 || targetIndex === -1) {
    throw new Error('Missing group');
  }

  const [sourceGroupId] = sourceGroups.splice(sourceIndex, 1);
  const insertIndex = place === 'before' ? targetIndex : targetIndex + 1;
  sourceGroups.splice(insertIndex, 0, sourceGroupId);

  database.columnEntries = database.columnEntries.map(column => ({
    ...column,
    groupOrder: sourceGroups.indexOf(column.groupId) + 1
  }));

  return fetchMatrixData();
}

export async function toggleMatrixCell({ leafId, rowId, checked }) {
  await wait(60);
  const column = getColumnByLeafId(leafId);

  if (!column || column.columnType === 'group-only') {
    return fetchMatrixData();
  }

  const nextRowIds = new Set(column.enabledRowIds);
  if (checked) {
    nextRowIds.add(rowId);
  } else {
    nextRowIds.delete(rowId);
  }

  database.columnEntries = database.columnEntries.map(item => {
    if (item.leafId !== leafId) return item;
    return {
      ...item,
      enabledRowIds: [...nextRowIds]
    };
  });

  return fetchMatrixData();
}
