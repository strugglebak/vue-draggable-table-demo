# vue-draggable-plus 表格拖拽 Demo

这个项目是一个最小可运行的表格拖拽示例，重点放在三件事上：

- 一级表头拖拽
- 二级表头拖拽
- 表体行拖拽

为了方便观察整个流程，项目保留了一层内存版 mock backend

[demo 在线预览](https://strugglebak.github.io/vue-draggable-table-demo/)

## 项目里有什么

页面左侧是说明和两份 JSON 预览：

- mock backend 当前返回的数据
- 前端整理后的视图模型

右侧是实际可操作的表格区域，可以直接体验：

- 拖动第一行，调整一级分组顺序
- 在分组内部拖动第二行，调整子表头顺序
- 拖动表体中的行
- 勾选或取消勾选单元格
- 点击“刷新数据”或“重置 mock 数据”

这几种操作都会重新走一次数据刷新流程，所以比较容易看清楚每一步的数据变化。

## 运行方式

```bash
pnpm install
pnpm dev
```

启动后打开 Vite 提示的本地地址即可。

## 技术栈

- Vue 3
- Vite
- `vue-draggable-plus`

## 目录说明

- `src/App.vue`
  页面主逻辑。包含表头拖拽、行拖拽、勾选状态更新，以及把后端数据整理成界面结构的过程。
- `src/mockBackend.js`
  内存版数据源，模拟读取、排序更新、勾选更新和重置。
- `src/style.css`
  页面布局和样式。
- `src/main.js`
  应用入口。

## 数据结构

这个 demo 里后端返回的是两部分数据：

### `rowList`

表格行数据，包含行 id、显示名称、排序值，以及是否锁定。

```js
{
  id: 'row-1',
  label: 'Row A',
  sort: 1,
  locked: false
}
```

### `columnEntries`

拍平后的叶子列数据。前端不会直接把它当成最终表头来渲染，而是先排序，再按 `groupId` 组装成一级分组和二级表头。

```js
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
}
```

`columnType` 目前有三种：

- `standalone`：独立列，只有一级表头
- `group-child`：分组列，带可拖动的二级表头
- `group-only`：只有分组占位，没有可勾选的真实叶子列

## 前端怎么组织表格

页面真正用来渲染的数据有三层：

- `rowItems`：排序后的行
- `flatColumns`：排序后的叶子列
- `columnGroups`：根据 `groupId` 聚合后的一级分组

可以把它理解成下面这条关系：

```text
mock backend response
  -> rowList       -> rowItems
  -> columnEntries -> flatColumns
  -> flatColumns   -> columnGroups
```

也就是说，后端只负责给出拍平数据，前端负责把它整理成最终界面。

## 拖拽逻辑

### 一级表头

一级表头拖动的是 `columnGroups`。拖拽结束后，会根据拖动结果调用 `changeGroupSort()`，然后重新执行一次 `fetchMatrixData()`。

这里的关键点是：前端不会把本地临时顺序当成最终结果，最终展示还是以后端返回的数据为准。

### 二级表头

二级表头拖动发生在某个分组内部，对应的是同组内叶子列顺序调整。拖拽结束后会调用 `changeChildSort()`，然后重新刷新。

这个 demo 只支持组内拖动，不支持跨组移动。

### 行拖拽

表体行拖动对应 `rowItems`。拖拽结束后调用 `changeRowSort()`，再重新刷新表格数据。

## 为什么要保留 mock backend

如果只是做一个纯前端拖拽 demo，直接交换数组位置就够了；但在很多真实项目里，拖拽完成后通常还要：

1. 计算排序参数
2. 调用排序接口
3. 重新获取数据
4. 用最新结果重建页面

这个项目保留 mock backend，主要就是为了把这条链路完整跑通，这样在对照原始业务代码时会更顺手。

## 建议阅读顺序

建议按下面的顺序看：

1. `src/mockBackend.js`
2. `src/App.vue` 里的 `rebuildViewModel()`
3. 一级表头拖拽相关逻辑
4. 二级表头拖拽相关逻辑
5. 行拖拽和单元格勾选逻辑

## 可以继续扩展的方向

- 换成更接近真实业务的表头和单元格结构
- 增加更复杂的拖拽限制
- 模拟更真实的接口参数和返回值
- 增加跨组规则或更多列类型
