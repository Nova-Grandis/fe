import {
  memo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'

import { ChevronRight } from 'lucide-react'

import { srOnly } from '@shared/config/theme'
import { useMoveAnimation } from '@shared/lib/useMoveAnimation'

import { Navigator } from '../Navigator'

import * as styles from './Table.css'

import type { LucideIcon } from 'lucide-react'

export type TableAlign = 'left' | 'center' | 'right'

export type TableColumn<T> = {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: TableAlign
  width?: string
}

export type TableRowAction<T> = {
  /** 스크린리더용 문구. 행마다 무엇으로 들어가는지 구분돼야 한다 */
  label: (row: T) => string
  onClick: (row: T) => void
  header?: ReactNode
  /** 기본은 상세로 들어가는 > 다. 수정처럼 다른 동작이면 그에 맞는 아이콘을 넘긴다 */
  icon?: LucideIcon
}

export type TableProps<T> = {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  emptyMessage?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  /**
   * 행 끝에 상세로 들어가는 > 열을 붙인다. onRowClick과 같이 쓰는 게 보통이며,
   * 행 전체가 눌린다는 걸 모르는 사용자를 위한 눈에 보이는 진입점이다.
   */
  rowAction?: TableRowAction<T>
  /**
   * 불러오는 중 — 행 자리에 회색 줄을 깐다. 빈 문구(emptyMessage)로 '불러오는 중'을 쓰면
   * 0건과 구별이 안 되고, 다 오면 표 높이가 갑자기 바뀐다.
   */
  loading?: boolean
  /** 로딩 줄 수. 안 주면 pageSize, 그것도 없으면 5줄 */
  loadingRows?: number
  /** 행마다 붙일 클래스(예: 실패한 행 강조) */
  rowClassName?: (row: T) => string | undefined
  /** 행(tr)에 얹을 속성(예: 끌어서 순서 바꾸기). 클래스는 rowClassName으로, 클릭은 onRowClick으로 준다 */
  rowProps?: (
    row: T,
  ) => Omit<HTMLAttributes<HTMLTableRowElement>, 'className' | 'onClick'>
  /** 행 순서가 바뀌면 옛 자리에서 새 자리로 미끄러지게 한다(끌어서 순서 바꾸기) */
  animateRowMoves?: boolean
  /**
   * 주면 행을 기억해 두고, 행 데이터(row)나 이 값들이 바뀔 때만 다시 그린다. 칸·클릭이 쓰는 바깥
   * 값(고른 것, 지금 시각, 돌아갈 주소 등)을 빠짐없이 넣는다 — 빠지면 그 값이 바뀌어도 행이 그대로다.
   * 행이 수백 개 넘게 쌓이고 위에서 자주 다시 그려지는 표(자동 갱신)에만 쓴다.
   */
  rowDeps?: readonly unknown[]
  className?: string
}

const ACTION_COLUMN_KEY = 'table-row-action'
const DEFAULT_LOADING_ROWS = 5

type TableRowProps<T> = Pick<
  TableProps<T>,
  'onRowClick' | 'rowClassName' | 'rowProps' | 'rowDeps'
> & {
  row: T
  columns: TableColumn<T>[]
}

function TableRowBase<T>({
  row,
  columns,
  onRowClick,
  rowClassName,
  rowProps,
}: TableRowProps<T>) {
  return (
    <tr
      {...rowProps?.(row)}
      className={[
        styles.row,
        onRowClick && styles.rowClickable,
        rowClassName?.(row),
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onRowClick && (() => onRowClick(row))}
    >
      {columns.map(({ key, render, align = 'left' }) => (
        <td key={key} className={styles.cell[align]}>
          {render(row)}
        </td>
      ))}
    </tr>
  )
}

const sameDeps = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

// rowDeps가 없으면 지금처럼 늘 다시 그린다. 있으면 행과 rowDeps만 비교한다 — columns·콜백은
// 렌더마다 새로 만들어져 비교하면 늘 다르다.
const TableRow = memo(
  TableRowBase,
  (prev, next) =>
    next.rowDeps !== undefined &&
    prev.rowDeps !== undefined &&
    prev.row === next.row &&
    sameDeps(prev.rowDeps, next.rowDeps),
) as <T>(props: TableRowProps<T>) => ReactNode

export function Table<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = '데이터가 없습니다.',
  pageSize,
  onRowClick,
  rowAction,
  loading = false,
  loadingRows,
  rowClassName,
  rowProps,
  animateRowMoves = false,
  rowDeps,
  className,
}: TableProps<T>) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null)
  const [page, setPage] = useState(1)
  const [lastRowCount, setLastRowCount] = useState(rows.length)
  if (rows.length !== lastRowCount) {
    setLastRowCount(rows.length)
    setPage(1)
  }

  const totalPages = pageSize ? Math.ceil(rows.length / pageSize) : 1
  const visibleRows = pageSize
    ? rows.slice((page - 1) * pageSize, page * pageSize)
    : rows
  // 로딩 줄엔 키가 없어 비워 둔다 — 다 오면 새로 재기 시작한다.
  useMoveAnimation(
    tbodyRef,
    animateRowMoves && !loading ? visibleRows.map(rowKey) : [],
  )

  // 액션 열은 평범한 열 하나로 만들어 둔다 — 헤더·빈 상태 colSpan·정렬이
  // 나머지 열과 같은 경로를 타서 따로 챙길 게 없어진다.
  const ActionIcon = rowAction?.icon ?? ChevronRight
  const allColumns: TableColumn<T>[] = rowAction
    ? [
        ...columns,
        {
          key: ACTION_COLUMN_KEY,
          header: rowAction.header ?? '',
          align: 'center',
          width: '80px',
          render: (row) => (
            <button
              type="button"
              className={styles.actionButton}
              aria-label={rowAction.label(row)}
              onClick={(event) => {
                // 행 클릭과 같이 쓰면 핸들러가 두 번 돈다.
                event.stopPropagation()
                rowAction.onClick(row)
              }}
            >
              <ActionIcon className={styles.actionIcon} aria-hidden="true" />
            </button>
          ),
        },
      ]
    : columns

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      {/* 표 밖의 live 영역 — 늘 두고 글자만 바꿔야 스크린리더가 바뀐 걸 알린다. */}
      <div className={srOnly} role="status" aria-live="polite">
        {loading ? '불러오는 중입니다.' : ''}
      </div>
      <div className={styles.root}>
        <table className={styles.table} aria-busy={loading || undefined}>
          <thead>
            <tr>
              {allColumns.map(({ key, header, align = 'left', width }) => (
                <th
                  key={key}
                  className={styles.headerCell[align]}
                  style={width ? { width } : undefined}
                  scope="col"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {loading ? (
              Array.from(
                { length: loadingRows ?? pageSize ?? DEFAULT_LOADING_ROWS },
                (_, index) => (
                  <tr key={index} className={styles.row}>
                    {allColumns.map(({ key, align = 'left' }) => (
                      <td key={key} className={styles.cell[align]}>
                        <span
                          className={styles.skeletonBar}
                          aria-hidden="true"
                        />
                      </td>
                    ))}
                  </tr>
                ),
              )
            ) : visibleRows.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={allColumns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  row={row}
                  columns={allColumns}
                  onRowClick={onRowClick}
                  rowClassName={rowClassName}
                  rowProps={rowProps}
                  rowDeps={rowDeps}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && totalPages > 1 && (
        <Navigator
          className={styles.navigator}
          totalPages={totalPages}
          currentPage={page}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
