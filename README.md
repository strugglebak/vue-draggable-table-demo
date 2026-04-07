# vue-draggable-plus 表格拖拽 Demo

这是一个从 `CRFSettings.vue` 抽离出来的最小可运行示例。

它故意去掉了原业务中的术语，只保留最核心的实现问题：

- 表格行如何拖动
- 一级表头如何拖动
- 二级表头如何拖动
- 前端如何把“后端返回的拍平数据”转换成“带分组的表头 + 表体矩阵”
- 为什么拖拽完成后，不是只改前端数组，而是通过“模拟后端接口”再刷新整个表格

如果你的目标是理解原始 `.vue` 文件里表格拖拽的实现思路，这个 demo 就是一个更容易观察和调试的版本。

## 这个 demo 演示了什么

- 使用 `vue-draggable-plus` 实现一级表头拖动
- 使用 `vue-draggable-plus` 实现二级表头拖动
- 使用 `vue-draggable-plus` 实现表体行拖动
- 使用 mock 后端模拟“排序接口”
- 每次拖拽或勾选后，重新获取数据并重建前端视图模型
- 左侧面板实时显示：
  - mock 后端原始返回
  - 前端派生后的视图模型

## 数据抽象

这个 demo 不再使用原始业务名词，而是抽象成下面几层：

### 1. `rowList`

表示表格里的“行数据”。

每一项大概是：

```js
{
  id: 'row-1',
  label: 'Row A',
  sort: 1,
  locked: false
}
```

含义：

- `id`: 行 id
- `label`: 行名称
- `sort`: 行排序
- `locked`: 是否锁定；锁定后这一行的单元格不能再编辑

### 2. `columnEntries`

表示后端返回的“拍平列数据”。

注意这里不是“分组好的表头”，而是更底层的叶子列数组。前端会基于它再组装一级表头和二级表头。

每一项大概是：

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

含义：

- `leafId`: 叶子列 id
- `groupId`: 所属一级分组 id
- `groupLabel`: 一级表头文案
- `childLabel`: 二级表头文案
- `metaLabel`: 第三行元信息文案
- `groupOrder`: 一级分组排序
- `childOrder`: 当前分组内的二级排序
- `columnType`: 当前列类型
- `enabledRowIds`: 哪些行在这一列下被勾选

### 3. `columnType`

这个字段决定该列在 UI 里如何表现：

- `standalone`
  - 独立列
  - 只有一级表头，没有可拖动的二级表头
- `group-child`
  - 属于某个分组下的子列
  - 有一级表头，也有可拖动的二级表头
- `group-only`
  - 只有分组，没有真正可勾选的叶子内容
  - 主要用于模拟“空组 / 纯组”这种情况

## 前端是怎么把后端数据变成表格的

前端主要维护三层数据：

- `rowItems`
  - 用于渲染表体行
- `flatColumns`
  - 用于渲染表体单元格，以及第三行元信息
- `columnGroups`
  - 用于渲染一级表头和二级表头

转换关系可以简单理解成：

```text
mock backend response
  -> rowList         -> rowItems
  -> columnEntries   -> flatColumns
  -> flatColumns 分组 -> columnGroups
```

也就是说：

- 后端只需要返回“拍平的列”
- 前端通过 `groupId` 把它们折叠成一级表头
- 同一个分组里的多条 `group-child` 会组成可拖动的二级表头

## 三种拖拽分别怎么实现

## 一级表头拖动

一级表头拖动绑定在 `columnGroups` 上。

拖动完成后：

1. 识别当前拖动的是哪个 `groupId`
2. 判断目标分组是谁
3. 调用 mock 后端里的 `changeGroupSort()`
4. mock 后端修改 `groupOrder`
5. 前端重新 `fetchMatrixData()`
6. 重新生成 `flatColumns` 和 `columnGroups`

这对应的是一种常见实现方式：

- 前端不把拖拽后的临时顺序当成最终结果
- 真正顺序由“后端返回的数据”决定

## 二级表头拖动

二级表头拖动绑定在某个分组内部的 `group.children` 上。

拖动完成后：

1. 识别当前拖动的是哪个 `leafId`
2. 找到它在当前组内的目标叶子列
3. 调用 mock 后端里的 `changeChildSort()`
4. mock 后端修改同组内的 `childOrder`
5. 前端重新刷新数据

这个 demo 里二级表头是“组内拖动”，不是跨组拖动。

这和原始代码的设计思路是一致的：二级表头对应的是“某个一级表头内部的子项顺序调整”。

## 行拖动

行拖动绑定在 `rowItems` 上。

拖动完成后：

1. 识别被拖动的 `rowId`
2. 根据目标位置计算新的 `sort`
3. 调用 mock 后端里的 `changeRowSort()`
4. mock 后端更新行顺序
5. 前端重新刷新数据

## 为什么要保留 mock 后端这一层

如果只做前端数组交换，虽然也能看到拖拽效果，但你会很难对照原始文件理解“为什么拖完还要刷新整张表”。

这个 demo 保留 mock 后端层，目的就是模拟原始代码里的真实流程：

```text
拖拽
  -> 计算排序参数
  -> 调后端排序接口
  -> 重新获取数据
  -> 重建表格
```

所以这个 demo 不是单纯的拖拽 UI，而是更偏“拖拽 + 数据回刷”的实现示例。

## 目录说明

- `src/App.vue`
  - 主界面
  - 包含一级表头、二级表头、行拖拽、勾选状态更新
- `src/mockBackend.js`
  - 内存版 mock 后端
  - 包含读取数据、排序、勾选更新、重置等方法
- `src/style.css`
  - 页面布局与样式
- `src/main.js`
  - 应用入口
- `vite.config.js`
  - Vite 配置

## 如何运行

```bash
cd /Users/jht/company/test/vue-draggable-table-demo
pnpm install
pnpm dev
```

浏览器打开本地 Vite 地址后，你可以直接操作：

- 拖动第一行表头
- 拖动第二行子表头
- 拖动表体中的行
- 勾选或取消勾选单元格
- 观察左侧 JSON 的变化

## 如何对照原始 `CRFSettings.vue` 去理解

可以这么对应着看：

- 原文件里的“表单行” -> 这里的 `rowList / rowItems`
- 原文件里的“拍平列 list” -> 这里的 `columnEntries / flatColumns`
- 原文件里的“一级表头 headers” -> 这里的 `columnGroups`
- 原文件里的“后端排序接口” -> 这里的 `changeGroupSort / changeChildSort / changeRowSort`
- 原文件里的“refreshTable” -> 这里的 `fetchMatrixData + rebuildViewModel`

如果你想要的不是“完全复刻原业务页面”，而是先搞懂结构和机制，那么建议按这个顺序看：

1. 先看 `src/mockBackend.js`
2. 再看 `src/App.vue` 里的 `rebuildViewModel()`
3. 然后看一级表头拖动
4. 再看二级表头拖动
5. 最后看行拖动

## 适合继续扩展的方向

如果你后续想把这个 demo 再往原项目靠近，可以继续加：

- 真正的 `table / thead / tbody / th / td` 结构
- 更接近原文件的三层表头 DOM
- 更复杂的拖拽限制规则
- 不同类型列之间的拖动约束
- 更接近后端接口参数的排序计算方式

## 备注

这个 demo 的目标是“帮助理解实现”，不是“1:1 复刻原项目业务”。

因此这里优先保留的是：

- 数据结构的抽象
- 拖拽后的处理流程
- 前后端职责边界

而不是具体业务命名或接口字段的真实含义。
