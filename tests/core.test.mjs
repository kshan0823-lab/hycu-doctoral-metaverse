import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const rooms = JSON.parse(await readFile(resolve('src/data/rooms.json'), 'utf8'))

test('기존 19개 구역과 확장 공간이 정의되어 있다', () => {
  assert.equal(rooms.length, 29)
  assert.equal(new Set(rooms.map((room) => room.roomId)).size, 29)
  assert.equal(rooms.find((room) => room.roomId === 'fitness').kind, 'fitness')
  assert.equal(rooms.find((room) => room.roomId === 'research05').owner, '심의준')
  assert.equal(rooms.find((room) => room.roomId === 'professor').owner, '김승환')
  assert.deepEqual(rooms.filter((room) => room.kind === 'research').map((room) => room.owner), ['문국찬', '윤금순', '김태영', '김두호', '심의준'])
  assert.equal(rooms.find((room) => room.roomId === 'quiet05').labelKo, '개인 휴게실 05')
  assert.equal(rooms.find((room) => room.roomId === 'facultyLounge').kind, 'professor-lounge')
  assert.equal(rooms.filter((room) => room.kind === 'private-washroom').length, 6)
})

test('문서 기준 핵심 좌석 수가 맞다', () => {
  const find = (id) => rooms.find((room) => room.roomId === id)
  assert.equal(find('amphitheater').seatCount, 21)
  assert.equal(find('global').seatCount, 10)
  assert.equal(find('lounge').seatCount, 12)
  assert.equal(find('cafe').seatCount, 6)
  assert.equal(find('library').seatCount, 12)
  assert.equal(find('garden').seatCount, 8)
  assert.equal(find('fitness').seatCount, 0)
  assert.equal(rooms.filter((room) => room.kind === 'research').length, 5)
  assert.equal(rooms.filter((room) => room.kind === 'quiet').length, 5)
  assert.equal(find('facultyLounge').size[0] * find('facultyLounge').size[2], 84)
  assert.equal(find('facultyLounge').seatCount, 6)
  assert.deepEqual(rooms.filter((room) => room.kind === 'private-washroom').map((room) => room.owner), ['김승환', '문국찬', '윤금순', '김태영', '김두호', '심의준'])
})

test('모든 공간에 이동에 필요한 기본 정보가 있다', () => {
  for (const room of rooms) {
    assert.ok(room.labelKo)
    assert.equal(room.overviewPosition.length, 3)
    assert.equal(room.size.length, 3)
    assert.ok(room.description)
    assert.ok(Array.isArray(room.features) && room.features.length > 0)
  }
})
