import { describe, expect, it } from 'vitest'

import { newDeadLettersOf, uniqueDeadLetters } from './history'

import type { DeadLetter } from './types'

const item = (deadLetterId: string) => ({ deadLetterId }) as DeadLetter
const ids = (items: readonly DeadLetter[]) =>
  items.map(({ deadLetterId }) => deadLetterId)

describe('uniqueDeadLetters', () => {
  it('밀려서 다음 쪽에 또 온 줄은 처음 것만 남긴다', () => {
    const pages = [item('d'), item('c'), item('b'), item('b'), item('a')]
    expect(ids(uniqueDeadLetters(pages))).toEqual(['d', 'c', 'b', 'a'])
  })
})

describe('newDeadLettersOf', () => {
  it('목록 맨 위보다 앞에 쌓인 것만 고른다', () => {
    const result = newDeadLettersOf(
      [item('f'), item('e'), item('d')],
      [item('d'), item('c')],
    )
    expect(ids(result.pending)).toEqual(['f', 'e'])
    expect(result.gap).toBe(false)
  })

  it('새로 쌓인 게 없으면 비운다', () => {
    expect(newDeadLettersOf([item('d')], [item('d')]).pending).toEqual([])
  })

  it('목록 맨 위가 맨 앞 쪽 밖으로 밀렸으면 gap이다', () => {
    expect(newDeadLettersOf([item('z')], [item('d')]).gap).toBe(true)
  })

  it('목록을 아직 못 받았으면 건드리지 않는다', () => {
    expect(newDeadLettersOf([item('d')], [])).toEqual({
      pending: [],
      gap: false,
    })
  })
})
