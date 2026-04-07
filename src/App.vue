<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { VueDraggable } from 'vue-draggable-plus';
import {
  changeChildSort,
  changeGroupSort,
  changeRowSort,
  fetchMatrixData,
  resetDemoData,
  toggleMatrixCell
} from './mockBackend';

const LEAF_WIDTH = 160;

const loading = ref(false);
const lastAction = ref('就绪');
const rawResponse = ref({ rowList: [], columnEntries: [] });
const rowItems = ref([]);
const flatColumns = ref([]);
const columnGroups = ref([]);

const dragState = reactive({
  groupId: '',
  childId: '',
  parentGroupId: '',
  rowId: ''
});

const bodyGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${flatColumns.value.length}, ${LEAF_WIDTH}px)`
}));

const backendPreview = computed(() =>
  JSON.stringify(rawResponse.value, null, 2)
);

const frontEndPreview = computed(() =>
  JSON.stringify(
    {
      rowItems: rowItems.value,
      flatColumns: flatColumns.value.map(column => ({
        leafId: column.leafId,
        groupId: column.groupId,
        groupLabel: column.groupLabel,
        childLabel: column.childLabel,
        columnType: column.columnType,
        metaLabel: column.metaLabel
      })),
      columnGroups: columnGroups.value.map(group => ({
        id: group.id,
        label: group.label,
        kind: group.kind,
        childLeafIds: group.children.map(child => child.leafId)
      }))
    },
    null,
    2
  )
);

function sortRows(rows) {
  return [...rows].sort((a, b) => a.sort - b.sort);
}

function sortColumns(columns) {
  return [...columns].sort((a, b) => {
    if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
    return a.childOrder - b.childOrder;
  });
}

function buildColumnGroups(columns) {
  const groups = [];

  columns.forEach(column => {
    const existingGroup = groups.find(group => group.id === column.groupId);

    if (existingGroup) {
      existingGroup.children.push(column);
      return;
    }

    groups.push({
      id: column.groupId,
      label: column.groupLabel,
      kind: column.columnType === 'group-child' ? 'grouped' : column.columnType,
      children: [column]
    });
  });

  return groups;
}

function rebuildViewModel(response) {
  rawResponse.value = response;
  rowItems.value = sortRows(response.rowList);
  flatColumns.value = sortColumns(response.columnEntries);
  columnGroups.value = buildColumnGroups(flatColumns.value);
}

async function applyMutation(runMutation, message) {
  loading.value = true;

  try {
    const nextData = await runMutation();
    rebuildViewModel(nextData);
    lastAction.value = message;
  } catch (error) {
    lastAction.value = error instanceof Error ? error.message : '未知错误';
  } finally {
    loading.value = false;
    dragState.groupId = '';
    dragState.childId = '';
    dragState.parentGroupId = '';
    dragState.rowId = '';
  }
}

async function refreshTable(message = '已从 mock 后端刷新数据') {
  loading.value = true;

  try {
    const nextData = await fetchMatrixData();
    rebuildViewModel(nextData);
    lastAction.value = message;
  } finally {
    loading.value = false;
  }
}

function groupWidth(group) {
  return `${Math.max(group.children.length, 1) * LEAF_WIDTH}px`;
}

function getGroupById(groupId) {
  return columnGroups.value.find(group => group.id === groupId);
}

function isCellChecked(row, column) {
  return column.enabledRowIds.includes(row.id);
}

function isCellDisabled(row, column) {
  return row.locked || column.columnType === 'group-only';
}

function childPlaceholderText(group) {
  if (group.kind === 'standalone') return '单列，无二级表头';
  return '没有可拖动的二级表头';
}

function cellCaption(row, column) {
  if (column.columnType === 'group-only') return '不可用';
  if (row.locked) return '该行已锁定';
  return isCellChecked(row, column) ? '已勾选' : '空';
}

function checkGroupMove(event) {
  if (!event.related) return true;

  const sourceKind = event.dragged?.dataset?.kind;
  const targetKind = event.related?.dataset?.kind;

  const canMoveStandalone =
    sourceKind === 'standalone' && ['standalone', 'grouped'].includes(targetKind);
  const canMoveEmpty = sourceKind === 'group-only' && targetKind === 'group-only';
  const canMoveGrouped =
    sourceKind === 'grouped' && ['standalone', 'grouped'].includes(targetKind);

  return canMoveStandalone || canMoveEmpty || canMoveGrouped;
}

function onGroupStart(event) {
  dragState.groupId = columnGroups.value[event.oldIndex]?.id || '';
}

async function onGroupUpdate(event) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || !dragState.groupId) return;

  const movingRight = oldIndex < newIndex;
  const targetGroup = movingRight
    ? columnGroups.value[newIndex - 1]
    : columnGroups.value[newIndex + 1];

  if (!targetGroup || targetGroup.id === dragState.groupId) {
    await refreshTable('一级表头顺序未变化');
    return;
  }

  await applyMutation(
    () =>
      changeGroupSort({
        groupId: dragState.groupId,
        targetGroupId: targetGroup.id,
        place: movingRight ? 'after' : 'before'
      }),
    `已将一级表头 "${dragState.groupId}" ${movingRight ? '移动到' : '移动到'} "${targetGroup.id}" 的${movingRight ? '后面' : '前面'}`
  );
}

function onChildStart(groupId, event) {
  const group = getGroupById(groupId);
  dragState.parentGroupId = groupId;
  dragState.childId = group?.children[event.oldIndex]?.leafId || '';
}

async function onChildUpdate(groupId, event) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || !dragState.childId) return;

  const liveGroup = getGroupById(groupId);
  if (!liveGroup) return;

  const movingRight = oldIndex < newIndex;
  const targetChild = movingRight
    ? liveGroup.children[newIndex - 1]
    : liveGroup.children[newIndex + 1];

  if (!targetChild || targetChild.leafId === dragState.childId) {
    await refreshTable('二级表头顺序未变化');
    return;
  }

  await applyMutation(
    () =>
      changeChildSort({
        leafId: dragState.childId,
        targetLeafId: targetChild.leafId,
        place: movingRight ? 'after' : 'before'
      }),
    `已将二级表头 "${dragState.childId}" ${movingRight ? '移动到' : '移动到'} "${targetChild.leafId}" 的${movingRight ? '后面' : '前面'}`
  );
}

function onRowStart(event) {
  dragState.rowId = rowItems.value[event.oldIndex]?.id || '';
}

async function onRowUpdate(event) {
  const { oldIndex, newIndex } = event;
  if (oldIndex === newIndex || !dragState.rowId) return;

  await applyMutation(
    () =>
      changeRowSort({
        rowId: dragState.rowId,
        sort: newIndex + 1
      }),
    `已将行 "${dragState.rowId}" 移动到第 ${newIndex + 1} 位`
  );
}

async function onCellToggle(nextChecked, row, column) {
  if (isCellDisabled(row, column)) return;

  await applyMutation(
    () =>
      toggleMatrixCell({
        leafId: column.leafId,
        rowId: row.id,
        checked: nextChecked
      }),
    `已更新单元格（${row.id}, ${column.leafId}）`
  );
}

async function onReset() {
  await applyMutation(() => resetDemoData(), '已重置为初始 mock 数据');
}

onMounted(() => {
  refreshTable('已加载初始示例数据');
});
</script>

<template>
  <div class="page-shell">
    <aside class="panel side-panel">
      <h1>vue-draggable-plus 表格拖拽示例</h1>
      <p>
        这个 demo 去掉了业务名词，只保留最核心的结构：行、拍平后的叶子列、
        一级分组表头，以及可拖动的二级子表头。
      </p>

      <div class="badge-list">
        <span class="badge">rowList = 表格主体中的行数据</span>
        <span class="badge">columnEntries = 后端返回的拍平叶子列</span>
        <span class="badge">相同 groupId = 同一个一级表头分组</span>
        <span class="badge">group-child = 可拖动的二级表头</span>
      </div>

      <div class="toolbar">
        <button class="primary" type="button" @click="refreshTable()">
          刷新数据
        </button>
        <button type="button" @click="onReset">重置 mock 数据</button>
      </div>

      <p class="status-line">
        <strong>当前状态：</strong>
        <span>{{ loading ? '处理中...' : lastAction }}</span>
      </p>

      <div class="explain">
        <h2>如何操作</h2>
        <ol>
          <li>拖动最上面一行，调整一级表头分组顺序。</li>
          <li>在某个分组内部拖动，调整二级表头顺序。</li>
          <li>拖动表格主体中的行，调整行顺序。</li>
          <li>点击复选框，模拟矩阵单元格的绑定状态变化。</li>
        </ol>
      </div>

      <div class="json-block">
        <h2>Mock 后端返回</h2>
        <pre>{{ backendPreview }}</pre>
      </div>

      <div class="json-block">
        <h2>前端派生后的视图模型</h2>
        <pre>{{ frontEndPreview }}</pre>
      </div>
    </aside>

    <main class="panel main-panel">
      <div class="matrix-scroll">
        <section class="matrix-board">
          <div class="matrix-row top-row">
            <div class="corner-cell sticky-col">
              <div class="corner-title">Rows</div>
              <div class="corner-subtitle">fixed label column</div>
            </div>

            <VueDraggable
              v-model="columnGroups"
              item-key="id"
              class="group-track"
              animation="180"
              handle=".group-drag-handle"
              :move="checkGroupMove"
              @start="onGroupStart"
              @update="onGroupUpdate"
            >
              <div
                v-for="group in columnGroups"
                :key="group.id"
                class="group-cell"
                :class="`kind-${group.kind}`"
                :data-kind="group.kind"
                :style="{ width: groupWidth(group) }"
              >
                <div class="drag-strip group-drag-handle">drag</div>
                <div class="group-title">{{ group.label }}</div>
                <div class="group-meta">
                  {{ group.kind }} | {{ group.children.length }} leaf
                </div>
              </div>
            </VueDraggable>
          </div>

          <div class="matrix-row second-row">
            <div class="corner-cell sticky-col muted-cell">
              second-level headers
            </div>

            <div class="leaf-row-track">
              <template v-for="group in columnGroups" :key="group.id">
                <VueDraggable
                  v-if="group.kind === 'grouped'"
                  v-model="group.children"
                  item-key="leafId"
                  class="child-track"
                  animation="180"
                  handle=".child-drag-handle"
                  :style="{ width: groupWidth(group) }"
                  @start="event => onChildStart(group.id, event)"
                  @update="event => onChildUpdate(group.id, event)"
                >
                  <div
                    v-for="child in group.children"
                    :key="child.leafId"
                    class="child-cell"
                  >
                    <div class="drag-strip child-drag-handle">drag</div>
                    <div class="child-title">{{ child.childLabel }}</div>
                  </div>
                </VueDraggable>

                <div
                  v-else
                  class="child-placeholder"
                  :style="{ width: groupWidth(group) }"
                >
                  {{ childPlaceholderText(group) }}
                </div>
              </template>
            </div>
          </div>

          <div class="matrix-row third-row">
            <div class="corner-cell sticky-col muted-cell">meta row</div>

            <div class="meta-track" :style="bodyGridStyle">
              <div
                v-for="column in flatColumns"
                :key="column.leafId"
                class="meta-cell"
              >
                {{ column.metaLabel }}
              </div>
            </div>
          </div>

          <VueDraggable
            v-model="rowItems"
            item-key="id"
            class="body-list"
            animation="180"
            handle=".row-drag-handle"
            @start="onRowStart"
            @update="onRowUpdate"
          >
            <div v-for="row in rowItems" :key="row.id" class="body-row">
              <div class="row-header sticky-col">
                <div class="drag-strip row-drag-handle">drag</div>
                <div class="row-copy">
                  <div class="row-label">
                    {{ row.sort }}. {{ row.label }}
                  </div>
                  <div class="row-note">
                    {{ row.locked ? 'locked row: cells disabled' : 'editable row' }}
                  </div>
                </div>
              </div>

              <div class="body-cells" :style="bodyGridStyle">
                <label
                  v-for="column in flatColumns"
                  :key="column.leafId"
                  class="data-cell"
                  :class="{ disabled: isCellDisabled(row, column) }"
                >
                  <input
                    type="checkbox"
                    :checked="isCellChecked(row, column)"
                    :disabled="isCellDisabled(row, column)"
                    @change="onCellToggle($event.target.checked, row, column)"
                  />
                  <span>{{ cellCaption(row, column) }}</span>
                </label>
              </div>
            </div>
          </VueDraggable>
        </section>
      </div>
    </main>
  </div>
</template>
