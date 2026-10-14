import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // extra per-column hints used by the detail table: class names for header / body cells and "has a header filter"
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    th?: string
    td?: string
    filter?: boolean
  }
}
