import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import roomsJson from './data/rooms.json'

type RoomKind = 'lobby' | 'professor' | 'research' | 'server' | 'amphitheater' | 'global' | 'lounge' | 'cafe' | 'library' | 'quiet' | 'defense' | 'lab' | 'garden' | 'fitness' | 'professor-lounge' | 'private-washroom'
type RoomSpec = {
  roomId: string
  labelKo: string
  labelEn: string
  kind: RoomKind
  size: [number, number, number]
  overviewPosition: [number, number, number]
  seatCount: number
  access: string
  theme: string
  description: string
  features: string[]
  owner?: string
}
type Panel = 'resources' | 'guidance' | 'seat' | 'connection' | 'access' | null
type Role = 'professor' | 'research01' | 'research02' | 'research03' | 'research04' | 'research05'
type GuidanceNote = { id: number; author: string; version: string; section: string; note: string; status: string; date: string }
type Resource = { title: string; type: string; year: string; keywords: string; access: string; source: string }
type CharacterOption = { id: string; gender: 'male' | 'female'; label: string; emoji: string; color: string }
type RoleOption = { id: Role; label: string; name: string; characterId: string }
type EntryMode = 'member' | 'visitor'
type AccessRequest = { id: number; kind: EntryMode; roleId?: Role; roleLabel: string; name: string; studentNumber?: string; phone?: string; visitPurpose?: string; status: 'pending' | 'approved' | 'rejected' | 'hold' | 'needs-purpose'; createdAt: string }
type AttendanceStatus = 'current' | 'early-leave' | 'left'
type AttendanceRecord = { id: number; requestId: number; name: string; roleLabel: string; entryMode: EntryMode; status: AttendanceStatus; enteredAt: string; changedAt: string }
type RoomAccessState = 'allowed' | 'approval' | 'pending' | 'restricted'
type RoomAccessRequest = { id: number; roomId: string; requesterName: string; requesterRole: Role | null; requesterMode: EntryMode; ownerName: string; status: 'pending' | 'approved' | 'rejected'; requestText: string; responseText?: string; createdAt: string }
type Announcement = { id: number; category: string; title: string; author: string; createdAt: string; updatedAt?: string; content: string; pinned: boolean }

const rooms = roomsJson as RoomSpec[]
const characterOptions: CharacterOption[] = [
  { id: 'male-student', gender: 'male', label: '남자 학생', emoji: '👨‍🎓', color: '#5d83b9' },
  { id: 'male-teacher', gender: 'male', label: '남자 교수', emoji: '👨‍🏫', color: '#a87552' },
  { id: 'male-scientist', gender: 'male', label: '남자 연구자', emoji: '👨‍🔬', color: '#628a78' },
  { id: 'male-tech', gender: 'male', label: '남자 기술연구자', emoji: '👨‍💻', color: '#7568a7' },
  { id: 'male-office', gender: 'male', label: '남자 연구행정', emoji: '👨‍💼', color: '#8c6c50' },
  { id: 'female-student', gender: 'female', label: '여자 학생', emoji: '👩‍🎓', color: '#b86b8c' },
  { id: 'female-teacher', gender: 'female', label: '여자 교수', emoji: '👩‍🏫', color: '#ce8a5a' },
  { id: 'female-scientist', gender: 'female', label: '여자 연구자', emoji: '👩‍🔬', color: '#5d9c8a' },
  { id: 'female-tech', gender: 'female', label: '여자 기술연구자', emoji: '👩‍💻', color: '#8271b8' },
  { id: 'female-office', gender: 'female', label: '여자 연구행정', emoji: '👩‍💼', color: '#bd7b6c' },
]
const characterById = Object.fromEntries(characterOptions.map((character) => [character.id, character])) as Record<string, CharacterOption>
const roleOptions: RoleOption[] = [
  { id: 'professor', label: '과목운영책임 교수', name: '과목운영책임 교수', characterId: 'male-teacher' },
  { id: 'research01', label: '연구생 01번 문국찬 연구생', name: '문국찬', characterId: 'male-student' },
  { id: 'research02', label: '연구생 02번 윤금순 연구생', name: '윤금순', characterId: 'female-student' },
  { id: 'research03', label: '연구생 03번 김태영 연구생', name: '김태영', characterId: 'male-scientist' },
  { id: 'research04', label: '연구생 04번 김두호 연구생', name: '김두호', characterId: 'male-tech' },
  { id: 'research05', label: '연구생 05번 심의준 연구생', name: '심의준', characterId: 'male-office' },
]

function roomOwnerRole(room: RoomSpec): Role | null {
  if (room.roomId === 'professor' || room.roomId === 'facultyLounge' || room.roomId === 'washroomProfessor') return 'professor'
  const match = room.roomId.match(/(?:research|quiet|washroomResearch)(0[1-5])$/)
  return match ? `research${match[1]}` as Role : null
}

function roomNeedsApproval(room: RoomSpec) {
  return room.kind === 'professor' || room.kind === 'research'
}
const palette: Record<string, string> = {
  cream: '#c9b79f', walnut: '#9a6b4a', stone: '#8f918f', green: '#668575', charcoal: '#575e65', server: '#476373', theater: '#936d54', global: '#4e7e8d', garden: '#68895f', fitness: '#875844', faculty: '#b08a59', washroom: '#78a3a3',
}
const accent = '#c5a16b'
const initialNotes: GuidanceNote[] = [
  { id: 1, author: '김승환 지도교수(가상)', version: 'v0.3 연구계획서', section: '연구질문', note: '도시재생 대상지 선정 이유를 한 문단으로 정리해 보세요.', status: '수정 요청', date: '2026-11-11' },
  { id: 2, author: '문국찬 연구생', version: 'v0.2 연구계획서', section: '2장', note: '공개 요약에 반영할 핵심 키워드를 추가했습니다.', status: '확인 완료', date: '2026-11-10' },
]
const initialAnnouncements: Announcement[] = [
  { id: 1, category: '캠퍼스 안내', title: '2026년 11월 연구캠퍼스 이용 안내', author: '과목운영책임 교수', createdAt: '2026-11-11', content: '<h2>연구캠퍼스 이용 안내</h2><p>입장 승인 후 29개 연구공간을 확인할 수 있습니다. 교수실과 연구생 연구실은 담당자 승인 후 입장해 주세요.</p><ul><li>마우스 좌우·위아래 드래그: 화면 이동</li><li>마우스 휠: 전체 공간 확대·축소</li><li>공간 클릭: 구역 이동과 자료 확인</li></ul>', pinned: true },
  { id: 2, category: '논문지도', title: '박사논문 지도 일정 확인', author: '과목운영책임 교수', createdAt: '2026-11-10', content: '<h2>논문지도 일정</h2><p>교수 연구실의 논문지도 메뉴에서 연구계획서 버전과 지도 의견을 확인할 수 있습니다.</p><p>개인 상담이 필요한 연구생은 연구실 입장 대화창에 <strong>신청</strong>을 남겨 주세요.</p>', pinned: false },
  { id: 3, category: '시설 이용', title: '개인 공간 출입 안내', author: '캠퍼스 운영팀', createdAt: '2026-11-09', content: '<h2>개인 공간 이용 수칙</h2><p>교수 오피스텔, 개인 휴게실, 화장실·샤워실은 담당자 본인 외 입장이 제한됩니다.</p><ol><li>공용 공간은 자유롭게 이용합니다.</li><li>독립 공간은 담당자 허락을 먼저 받습니다.</li><li>시설 이용 후에는 원래 상태로 정리합니다.</li></ol>', pinned: false },
]
const resourceCatalog: Resource[] = [
  { title: '가상 연구자료 · 도시재생 사업성 검토', type: 'PDF 시연 자료', year: '2026', keywords: '도시재생, 사업성, 필지', access: '공개 데모', source: 'HYCU 연구캠퍼스 시연 데이터' },
  { title: '가상 연구자료 · 공간구조와 보행 네트워크', type: '텍스트 메모', year: '2026', keywords: '공간구조, 보행, 네트워크', access: '수업 참여자', source: '가상 수업 자료' },
  { title: '공개 참고 링크 · 도시공간 분석 개요', type: '웹 링크', year: '2025', keywords: '도시공간, 분석, 사례', access: '공개 데모', source: '공개 자료 연결 예시' },
  { title: '가상 강의자료 · 박사논문 연구 설계', type: '강의 슬라이드', year: '2026', keywords: '논문, 연구설계, 방법론', access: '수업 참여자', source: '가상 강의 자료' },
]

function makeTextSprite(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(41, 45, 49, .94)'
  ctx.roundRect(5, 8, 710, 112, 22)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 5
  ctx.roundRect(5, 8, 710, 112, 22)
  ctx.stroke()
  ctx.fillStyle = '#fffaf2'
  ctx.font = '700 32px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 360, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  sprite.scale.set(7.2, 1.28, 1)
  return sprite
}

function sanitizeRichText(html: string) {
  if (typeof DOMParser === 'undefined') return html.replace(/<script[\s\S]*?<\/script>/gi, '')
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')
  documentFragment.querySelectorAll('script,style,iframe,object,embed,form').forEach((node) => node.remove())
  documentFragment.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      if (name.startsWith('on') || name === 'style' || (name === 'href' && !/^(https?:\/\/|mailto:)/i.test(attribute.value))) element.removeAttribute(attribute.name)
      else if (!['href', 'target'].includes(name)) element.removeAttribute(attribute.name)
    })
  })
  return documentFragment.body.innerHTML || '<p></p>'
}

function box(parent: THREE.Group, size: [number, number, number], position: [number, number, number], color: string, options: { opacity?: number; roomId?: string; seatId?: string } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: color === '#c5a16b' ? .7 : .12, transparent: options.opacity !== undefined, opacity: options.opacity ?? 1 }))
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (options.roomId) mesh.userData.roomId = options.roomId
  if (options.seatId) mesh.userData.seatId = options.seatId
  parent.add(mesh)
  return mesh
}

function cylinder(parent: THREE.Group, radius: number, height: number, position: [number, number, number], color: string, segments = 24, options: { roomId?: string; seatId?: string } = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * .92, height, segments), new THREE.MeshStandardMaterial({ color, roughness: .58, metalness: .16 }))
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (options.roomId) mesh.userData.roomId = options.roomId
  if (options.seatId) mesh.userData.seatId = options.seatId
  parent.add(mesh)
  return mesh
}

function addSeat(parent: THREE.Group, id: string, roomId: string, position: [number, number, number], color: string, rotation = 0) {
  const seat = box(parent, [1.05, .32, 1.05], position, color, { roomId, seatId: id })
  seat.rotation.y = rotation
  box(parent, [.92, .86, .18], [position[0], position[1] + .5, position[2] + .43], color, { roomId, seatId: id })
}

function addPlant(parent: THREE.Group, position: [number, number, number]) {
  cylinder(parent, .32, .45, [position[0], position[1] + .22, position[2]], '#a47d54', 16)
  cylinder(parent, .58, 1.2, [position[0], position[1] + 1, position[2]], '#3f7256', 12)
}

function addShelf(parent: THREE.Group, position: [number, number, number], width = 2.8, depth = .35) {
  box(parent, [width, .16, depth], [position[0], position[1] + .35, position[2]], '#c5a16b')
  box(parent, [width, .16, depth], [position[0], position[1] + 1.05, position[2]], '#c5a16b')
  box(parent, [.12, 1.55, depth], [position[0] - width / 2, position[1] + .7, position[2]], '#49372e')
  box(parent, [.12, 1.55, depth], [position[0] + width / 2, position[1] + .7, position[2]], '#49372e')
  for (let i = -1; i <= 1; i += 1) box(parent, [.12, .55, .28], [position[0] + i * .45, position[1] + .7, position[2] - .08], '#d3aa70')
}

function addDesk(parent: THREE.Group, position: [number, number, number], color = '#5c4336') {
  box(parent, [2.8, .16, 1.1], [position[0], position[1] + 1.05, position[2]], color)
  box(parent, [.14, 1, .14], [position[0] - 1.1, position[1] + .5, position[2] - .36], color)
  box(parent, [.14, 1, .14], [position[0] + 1.1, position[1] + .5, position[2] - .36], color)
  box(parent, [1.5, .82, .08], [position[0], position[1] + 1.45, position[2] + .32], '#1b252c')
}

function makeEmojiSprite(emoji: string, borderColor: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.beginPath()
  ctx.arc(128, 128, 116, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.font = '150px "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 128, 136)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
  sprite.scale.set(1.65, 1.65, 1)
  return sprite
}

function buildEmojiAvatar(position: [number, number, number], character: CharacterOption, label: string, status: string) {
  const group = new THREE.Group()
  group.position.set(...position)
  cylinder(group, .34, .42, [0, .22, 0], character.color, 20)
  const emoji = makeEmojiSprite(character.emoji, character.color)
  emoji.position.y = 1.35
  group.add(emoji)
  const nameTag = makeTextSprite(`${label} · ${status}`, character.color)
  nameTag.scale.set(3.8, .68, 1)
  nameTag.position.y = 2.35
  group.add(nameTag)
  return group
}

function buildRoom(room: RoomSpec) {
  const group = new THREE.Group()
  group.position.set(...room.overviewPosition)
  group.userData.roomId = room.roomId
  const color = palette[room.theme] ?? palette.cream
  const [width, , depth] = room.size
  const wall = '#e6e1db'
  if (room.kind !== 'garden') {
    const roomLight = new THREE.PointLight('#ffd8b0', room.kind === 'amphitheater' ? 1.5 : 1.05, room.kind === 'amphitheater' ? 26 : 15, 2)
    roomLight.position.set(0, 3.2, 0)
    group.add(roomLight)
  }

  if (room.kind === 'amphitheater') {
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(10.5, 10.5, .35, 48), new THREE.MeshStandardMaterial({ color: '#4f3e37', roughness: .75 }))
    floor.position.y = -.18
    floor.userData.roomId = room.roomId
    floor.receiveShadow = true
    group.add(floor)
    for (let r = 0; r < 3; r += 1) {
      const n = [6, 7, 7][r]
      const radius = [5, 6.6, 8.2][r]
      const y = [.55, .9, 1.25][r]
      box(group, [18.5 - r * 2.8, .32, 1.35], [0, y - .2, 1.8 + r * 2.15], '#705546', { roomId: room.roomId })
      for (let i = 0; i < n; i += 1) {
        const theta = THREE.MathUtils.degToRad(-120 + i * (240 / (n - 1)))
        addSeat(group, `amp-r${r + 1}-s${String(i + 1).padStart(2, '0')}`, room.roomId, [radius * Math.sin(theta), y, radius * Math.cos(theta)], '#c2a17d', theta)
      }
    }
    box(group, [5.2, 1.8, .55], [0, .9, -4.8], '#6e4b3a', { roomId: room.roomId })
    box(group, [9, 3.8, .18], [0, 4, -9.2], '#172028', { roomId: room.roomId })
    const stageLabel = makeTextSprite('발표 무대 · 자료 화면', '#f3e9d7')
    stageLabel.position.set(0, 5.6, -9.05)
    group.add(stageLabel)
    return group
  }

  if (room.kind === 'fitness') {
    const track = new THREE.Mesh(new THREE.RingGeometry(10.5, 13.5, 72), new THREE.MeshStandardMaterial({ color: '#75483d', roughness: .84, metalness: .02 }))
    track.rotation.x = -Math.PI / 2
    track.position.y = .04
    track.userData.roomId = room.roomId
    track.receiveShadow = true
    group.add(track)
    for (const radius of [10.95, 12.05, 13.05]) {
      const lane = new THREE.Mesh(new THREE.TorusGeometry(radius, .055, 8, 72), new THREE.MeshStandardMaterial({ color: '#f1d5a4', roughness: .55, metalness: .05 }))
      lane.position.y = .16
      lane.userData.roomId = room.roomId
      group.add(lane)
    }
    const gymFloor = cylinder(group, 8.7, .38, [0, .12, 0], '#3f4a50', 64, { roomId: room.roomId })
    gymFloor.receiveShadow = true
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2
      box(group, [.22, 3.2, .22], [9 * Math.cos(angle), 1.6, 9 * Math.sin(angle)], '#d9d5cf', { roomId: room.roomId })
    }
    // 러닝머신과 웨이트 기구를 중앙 원형 공간에 배치합니다.
    for (let i = 0; i < 4; i += 1) {
      const angle = -Math.PI / 2 + i * .42
      const x = 4.5 * Math.cos(angle)
      const z = 4.5 * Math.sin(angle)
      box(group, [1.65, .16, .72], [x, .68, z], '#232b30', { roomId: room.roomId })
      box(group, [.12, 1.35, .12], [x, 1.35, z - .28], '#b1b8b5', { roomId: room.roomId })
      box(group, [1.05, .6, .08], [x, 1.75, z - .28], '#242d32', { roomId: room.roomId })
    }
    for (let i = 0; i < 3; i += 1) {
      const x = -4.2 + i * 2.2
      box(group, [1.25, .2, .62], [x, .78, 2.6], '#98654b', { roomId: room.roomId })
      box(group, [.12, 1.6, .12], [x, 1.5, 2.35], '#bfc3c0', { roomId: room.roomId })
      cylinder(group, .34, .12, [x - .58, 1.55, 2.35], '#272f33', 18, { roomId: room.roomId })
      cylinder(group, .34, .12, [x + .58, 1.55, 2.35], '#272f33', 18, { roomId: room.roomId })
    }
    cylinder(group, 1.55, .16, [0, .35, -2.8], '#8a5a48', 32, { roomId: room.roomId })
    box(group, [3.8, .16, .55], [0, .55, -2.8], '#c8b59c', { roomId: room.roomId })
    const fitnessLabel = makeTextSprite('대형 휘트니스 센터 · 원형 러닝트랙', '#d9a76e')
    fitnessLabel.position.set(0, 4.7, 0)
    fitnessLabel.userData.roomLabel = true
    fitnessLabel.userData.roomId = room.roomId
    group.add(fitnessLabel)
    return group
  }

  if (room.kind === 'private-washroom') {
    // 담당자별로 분리된 개인 화장실·샤워장입니다.
    box(group, [width, .28, depth], [0, -.15, 0], '#b8d0cb', { roomId: room.roomId })
    box(group, [width, 2.8, .22], [0, 1.4, -depth / 2], '#e4ece8', { roomId: room.roomId })
    box(group, [.22, 2.8, depth], [-width / 2, 1.4, 0], '#e4ece8', { roomId: room.roomId })
    box(group, [.22, 2.8, depth], [width / 2, 1.4, 0], '#e4ece8', { roomId: room.roomId })
    box(group, [width - .45, 2.55, .08], [0, 1.35, depth / 2 - .12], '#a7c8c5', { roomId: room.roomId, opacity: .28 })
    // 유리 샤워부스
    box(group, [1.55, 2.1, .08], [.92, 1.05, -1.25], '#b9ded9', { roomId: room.roomId, opacity: .34 })
    box(group, [.08, 2.1, 1.8], [.15, 1.05, -1.8], '#b9ded9', { roomId: room.roomId, opacity: .34 })
    box(group, [1.35, .08, 1.55], [.92, .05, -1.35], '#8db7b4', { roomId: room.roomId })
    cylinder(group, .18, .08, [.92, 2.32, -1.72], '#c5a16b', 18, { roomId: room.roomId })
    box(group, [.08, 1.3, .08], [.92, 1.65, -1.72], '#c5a16b', { roomId: room.roomId })
    cylinder(group, .28, .18, [.92, .32, 1.2], '#f2f3ed', 24, { roomId: room.roomId })
    box(group, [.65, .65, .5], [.92, .55, .82], '#f0f1eb', { roomId: room.roomId })
    box(group, [1.35, .72, .45], [-1.05, .42, 1.22], '#7f9995', { roomId: room.roomId })
    cylinder(group, .2, .08, [-1.05, .82, 1.22], '#d7c6a2', 18, { roomId: room.roomId })
    box(group, [1.05, 1.25, .08], [-1.05, 1.7, -2.38], '#9bb8b5', { roomId: room.roomId, opacity: .62 })
    box(group, [.65, .9, .08], [-1.05, 1.3, 2.05], '#bd9b70', { roomId: room.roomId })
    const washroomLabel = makeTextSprite(`${room.owner} · 개인 화장실 · 샤워장`, '#a6d3c9')
    washroomLabel.position.set(0, 3.45, 0)
    washroomLabel.userData.roomLabel = true
    washroomLabel.userData.roomId = room.roomId
    group.add(washroomLabel)
    return group
  }

  if (room.kind === 'professor-lounge') {
    // 84㎡(12m x 7m) 단층 오피스텔형 휴식 공간입니다.
    box(group, [width, .28, depth], [0, -.15, 0], '#b69772', { roomId: room.roomId })
    box(group, [width, 2.9, .24], [0, 1.45, -depth / 2], '#e6ddd0', { roomId: room.roomId })
    box(group, [.24, 2.9, depth], [-width / 2, 1.45, 0], '#e6ddd0', { roomId: room.roomId })
    box(group, [.24, 2.9, depth], [width / 2, 1.45, 0], '#e6ddd0', { roomId: room.roomId })
    box(group, [width - .8, 2.55, .08], [0, 1.42, depth / 2 - .12], '#b9d4d1', { roomId: room.roomId, opacity: .32 })
    box(group, [5.6, .58, 1.65], [-2.35, .3, .9], '#6f5145', { roomId: room.roomId })
    box(group, [1.7, .58, 1.65], [2.55, .3, 1.05], '#c8aa84', { roomId: room.roomId })
    box(group, [3.4, .18, 1.65], [0, .93, .9], '#b78d5d', { roomId: room.roomId })
    cylinder(group, 1.25, .12, [0, 1.04, .9], '#d7b27b', 40, { roomId: room.roomId })
    for (let i = 0; i < 6; i += 1) {
      const theta = (i / 6) * Math.PI * 2
      addSeat(group, `faculty-s${String(i + 1).padStart(2, '0')}`, room.roomId, [2.05 * Math.cos(theta), .46, .9 + 2.05 * Math.sin(theta)], i < 3 ? '#c5a16b' : '#8e6d58', theta + Math.PI)
    }
    addDesk(group, [-3.6, 0, -1.9], '#513d35')
    addShelf(group, [2.9, 0, -3.1], 4.1)
    box(group, [3.4, .92, .72], [1.8, .46, -2.25], '#6b7772', { roomId: room.roomId })
    box(group, [1.25, .92, .72], [3.95, .46, -2.25], '#8b6a55', { roomId: room.roomId })
    cylinder(group, .22, .08, [1.15, 1.02, -2.25], '#d7b27b', 18, { roomId: room.roomId })
    cylinder(group, .22, .08, [2.1, 1.02, -2.25], '#d7b27b', 18, { roomId: room.roomId })
    box(group, [2.35, .34, 1.05], [-3.1, .58, 2.65], '#536b70', { roomId: room.roomId })
    box(group, [.7, .34, 1.05], [-1.35, .58, 2.65], '#9b795f', { roomId: room.roomId })
    addPlant(group, [4.75, 0, 2.65])
    addPlant(group, [-5, 0, -2.65])
    const loungeLabel = makeTextSprite('교수 전용 · 84㎡ 럭셔리 오피스텔', '#e5bf7d')
    loungeLabel.position.set(0, 3.9, 0)
    loungeLabel.userData.roomLabel = true
    loungeLabel.userData.roomId = room.roomId
    group.add(loungeLabel)
    return group
  }

  if (room.kind === 'garden') {
    box(group, [width, .28, depth], [0, -.15, 0], '#557b58', { roomId: room.roomId })
    box(group, [width - 1, .16, .3], [0, .15, -depth / 2 + .45], '#c5a16b', { roomId: room.roomId })
    for (let i = 0; i < 8; i += 1) addSeat(group, `garden-s${String(i + 1).padStart(2, '0')}`, room.roomId, [-6.4 + (i % 4) * 4.2, .35, -1 + Math.floor(i / 4) * 2.6], '#d3b486', 0)
    for (const p of [[-7, 0, 3], [6.5, 0, 3], [0, 0, -3.2]] as [number, number, number][]) addPlant(group, p)
    return group
  }

  if (room.kind === 'lobby') {
    box(group, [width, .28, depth], [0, -.15, 0], '#9d8b73', { roomId: room.roomId })
    cylinder(group, 2.3, .18, [0, .1, 0], '#c5a16b', 48, { roomId: room.roomId })
    cylinder(group, 1.3, .9, [0, .55, 0], '#3b6a59', 32, { roomId: room.roomId })
    for (let i = 0; i < 4; i += 1) addPlant(group, [i * 2.2 - 3.3, 0, 4.2])
  } else {
    box(group, [width, .28, depth], [0, -.15, 0], color, { roomId: room.roomId })
    box(group, [width, 2.7, .22], [0, 1.35, -depth / 2], wall, { roomId: room.roomId })
    box(group, [.22, 2.7, depth], [-width / 2, 1.35, 0], wall, { roomId: room.roomId })
    box(group, [.22, 2.7, depth], [width / 2, 1.35, 0], wall, { roomId: room.roomId })
    box(group, [width * .35, 2.7, .22], [-width * .32, 1.35, depth / 2], wall, { roomId: room.roomId })
    box(group, [width * .28, 2.7, .22], [width * .35, 1.35, depth / 2], wall, { roomId: room.roomId })
  }

  if (room.kind === 'professor') {
    addDesk(group, [-2.5, 0, -2.3])
    addShelf(group, [3.2, 0, -4.25], 4.6)
    box(group, [4.3, .14, 2.2], [0, .92, 1], '#a67d56', { roomId: room.roomId })
    for (let i = 0; i < 4; i += 1) addSeat(group, `prof-s${i + 1}`, room.roomId, [-1.35 + (i % 2) * 2.7, .42, .15 + Math.floor(i / 2) * 1.7], '#c5a16b')
    box(group, [3.4, 1.8, .16], [0, 2.6, -4.15], '#1b252c', { roomId: room.roomId })
    addPlant(group, [-4.2, 0, 3])
  } else if (room.kind === 'research') {
    addDesk(group, [0, 0, 1])
    addShelf(group, [-2.7, 0, -3.2], 3.5)
    box(group, [3, 1.3, .14], [0, 1.8, -3.85], '#1b252c', { roomId: room.roomId })
    addSeat(group, `${room.roomId}-owner`, room.roomId, [0, .42, 2.35], '#c5a16b')
    addSeat(group, `${room.roomId}-guest01`, room.roomId, [-2.3, .42, 2.7], '#9c8366', Math.PI / 2)
    addSeat(group, `${room.roomId}-guest02`, room.roomId, [2.3, .42, 2.7], '#9c8366', -Math.PI / 2)
    addPlant(group, [2.8, 0, -2.7])
  } else if (room.kind === 'server') {
    for (let i = 0; i < 4; i += 1) {
      box(group, [1.15, 2.4, 4.4], [-2.5 + i * 1.65, 1.2, -.4], '#192a33', { roomId: room.roomId })
      for (let led = 0; led < 3; led += 1) cylinder(group, .06, .05, [-2.5 + i * 1.65 - .35, 1 + led * .38, -2.64], led === 1 ? '#b6d66d' : '#5bb7d0', 10, { roomId: room.roomId })
    }
    box(group, [3.2, .16, 1.8], [0, .9, 3], '#455d67', { roomId: room.roomId })
    addSeat(group, 'server-s01', room.roomId, [-1, .42, 3.05], '#c5a16b')
    addSeat(group, 'server-s02', room.roomId, [1, .42, 3.05], '#c5a16b')
  } else if (room.kind === 'global') {
    box(group, [8.4, .22, 3.2], [0, .92, .8], '#6c5648', { roomId: room.roomId })
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI * .86 + i * (Math.PI * 1.72 / 9)
      addSeat(group, `global-s${String(i + 1).padStart(2, '0')}`, room.roomId, [5 * Math.cos(angle), .45, .8 + 3.4 * Math.sin(angle)], '#b99368', angle + Math.PI)
    }
    box(group, [5.5, 2.4, .16], [0, 2.5, -4.2], '#172a32', { roomId: room.roomId })
    addPlant(group, [-5, 0, 2.8])
  } else if (room.kind === 'lounge') {
    box(group, [5.2, .65, 1.6], [0, .35, 0], '#6b5144', { roomId: room.roomId })
    for (let i = 0; i < 12; i += 1) addSeat(group, `lounge-s${String(i + 1).padStart(2, '0')}`, room.roomId, [-5.1 + (i % 6) * 2.05, .55, i < 6 ? -2.7 : 2.7], '#c5a16b', i < 6 ? 0 : Math.PI)
    addPlant(group, [-5, 0, 2])
    addPlant(group, [5, 0, -2])
  } else if (room.kind === 'cafe') {
    box(group, [9, 1.1, 1.1], [0, .55, -2], '#5d463b', { roomId: room.roomId })
    for (let i = 0; i < 6; i += 1) {
      addSeat(group, `cafe-s${String(i + 1).padStart(2, '0')}`, room.roomId, [-4 + i * 1.6, .5, -.2], '#bd9b70')
      cylinder(group, .16, .36, [-4 + i * 1.6, 1.3, -2], '#e5d4bd', 16, { roomId: room.roomId })
    }
    box(group, [1.5, 1.7, 1.1], [3.9, .85, -2], '#242d31', { roomId: room.roomId })
  } else if (room.kind === 'library') {
    for (let i = 0; i < 3; i += 1) addShelf(group, [-5.2 + i * 5.2, 0, -4.2], 4.2)
    for (let i = 0; i < 12; i += 1) addSeat(group, `library-s${String(i + 1).padStart(2, '0')}`, room.roomId, [-5.5 + (i % 6) * 2.2, .45, i < 6 ? .5 : 3.7], '#9c7e62')
    box(group, [5, .16, 1.9], [0, 1.05, 2.1], '#7a5a45', { roomId: room.roomId })
  } else if (room.kind === 'quiet') {
    addSeat(group, `${room.roomId}-s01`, room.roomId, [0, .48, .35], '#bd9b70')
    cylinder(group, .55, .12, [1.2, .06, 1.1], '#c5a16b', 20, { roomId: room.roomId })
    addPlant(group, [-1.25, 0, -1.25])
  } else if (room.kind === 'defense') {
    box(group, [4.4, .18, 2], [0, 1, -2.1], '#755442', { roomId: room.roomId })
    for (let i = 0; i < 8; i += 1) addSeat(group, `defense-s${String(i + 1).padStart(2, '0')}`, room.roomId, [-4.1 + (i % 4) * 2.75, .44, i < 4 ? .25 : 3], '#bd9b70')
    box(group, [4.8, 2.2, .16], [0, 2.7, -4.3], '#18232b', { roomId: room.roomId })
  } else if (room.kind === 'lab') {
    box(group, [6.6, .18, 2.4], [0, 1, 0], '#53645b', { roomId: room.roomId })
    for (let i = 0; i < 6; i += 1) addSeat(group, `lab-s${String(i + 1).padStart(2, '0')}`, room.roomId, [-4.5 + (i % 3) * 4.5, .43, i < 3 ? -2.3 : 2.3], '#c5a16b', i < 3 ? 0 : Math.PI)
    box(group, [2.7, .8, .18], [0, 1.6, 0], '#b59b74', { roomId: room.roomId })
    box(group, [.7, 1.3, .7], [1.2, .7, -.8], '#8f7d5b', { roomId: room.roomId })
    box(group, [1.2, .9, .6], [-1.3, .5, .7], '#6d896f', { roomId: room.roomId })
  }

  const label = makeTextSprite(room.labelKo, room.kind === 'research' ? '#f6ead9' : '#efdfc5')
  label.position.set(0, room.kind === 'server' ? 4.1 : 3.8, 0)
  label.userData.roomLabel = true
  label.userData.roomId = room.roomId
  group.add(label)
  return group
}

function buildAtriumStructure() {
  const atrium = new THREE.Group()
  // 모든 공간이 같은 바닥을 공유하는 넓은 단층 실내입니다.
  box(atrium, [74, .32, 126], [0, -.16, 28], '#bdb3a8')
  box(atrium, [66, .08, 116], [0, .03, 28], '#d9cbb8')
  box(atrium, [.5, 8.2, 126], [-36, 4.1, 28], '#ded8cf')
  box(atrium, [.5, 8.2, 126], [36, 4.1, 28], '#ded8cf')
  box(atrium, [74, 8.2, .5], [0, 4.1, -35], '#e3ddd3')
  box(atrium, [74, 8.2, .5], [0, 4.1, 91], '#e3ddd3')
  // 하나의 천장과 중앙 채광창
  box(atrium, [70, .18, 122], [0, 9.3, 28], '#b9d0d2', { opacity: .18 })
  for (let x = -30; x <= 30; x += 30) box(atrium, [.13, .18, 122], [x, 9.45, 28], '#f0eee7', { opacity: .56 })
  for (let z = -30; z <= 90; z += 30) box(atrium, [70, .18, .13], [0, 9.45, z], '#f0eee7', { opacity: .56 })
  for (const x of [-30, 30]) for (const z of [-28, 0, 28, 56, 84]) box(atrium, [.6, 8.8, .6], [x, 4.4, z], '#b9b4ab')

  // 중앙 공용 라운지와 낮은 계단형 좌석. 복층이 아니라 바닥에서 살짝 올라온 휴게 플랫폼입니다.
  for (let i = 0; i < 3; i += 1) box(atrium, [18 - i * 1.4, .16, 2.2], [0, .08 + i * .12, 10 + i * 2.1], '#cbb18f')
  cylinder(atrium, 3.2, .14, [0, .16, 3], '#8ebbc2', 48)
  for (const p of [[-8, 0, 8], [8, 0, 8], [-8, 0, 28], [8, 0, 28], [0, 0, 48]] as [number, number, number][]) addPlant(atrium, p)

  // 단층 실내의 방향을 알려주는 컬러 안내 배너
  const banners: Array<[number, number, string, string]> = [[-33, -8, '#83a83f', '연구'], [33, 8, '#5594a5', '연결'], [-33, 30, '#d98979', '학습'], [33, 48, '#74a75c', '휴식']]
  banners.forEach(([x, z, color, label]) => {
    box(atrium, [.28, 6.4, 1.3], [x, 5.2, z], color)
    const tag = makeTextSprite(label, color)
    tag.scale.set(2.7, .62, 1)
    tag.position.set(x + (x < 0 ? .6 : -.6), 5.2, z)
    atrium.add(tag)
  })
  const title = makeTextSprite('HYCU 박사논문 연구캠퍼스 · 넓은 단층 아트리움', '#bd8b55')
  title.position.set(0, 7.2, -31)
  title.scale.set(5.6, .9, 1)
  atrium.add(title)
  return atrium
}

type SceneViewProps = { selectedRoomId: string; avatarPosition: [number, number, number]; avatarCharacterId: string; displayName: string; resetToken: number; quality: '높음' | '보통' | '낮음'; onRoomSelect: (roomId: string) => void; onSeatSelect: (roomId: string, seatId: string) => void; onAvatarMove: (position: [number, number, number]) => void }
function SceneView({ selectedRoomId, avatarPosition, avatarCharacterId, displayName, resetToken, quality, onRoomSelect, onSeatSelect, onAvatarMove }: SceneViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const avatarRef = useRef<THREE.Group | null>(null)
  const targetRef = useRef(new THREE.Vector3(0, 0, 10))
  const distanceRef = useRef(52)
  const heightScaleRef = useRef(.9)
  const orbitAngleRef = useRef(Math.PI / 4)
  const orbitPitchRef = useRef(Math.atan(.9 / Math.SQRT2))
  const roomSelectRef = useRef(onRoomSelect)
  const seatSelectRef = useRef(onSeatSelect)
  const avatarMoveRef = useRef(onAvatarMove)
  roomSelectRef.current = onRoomSelect
  seatSelectRef.current = onSeatSelect
  avatarMoveRef.current = onAvatarMove

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dfe5e7')
    scene.fog = new THREE.Fog('#dfe5e7', 95, 170)
    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, .1, 300)
    camera.position.set(72, 66, 72)
    camera.lookAt(targetRef.current)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === '낮음' ? 1.2 : 1.7))
    renderer.setSize(host.clientWidth, host.clientHeight)
    renderer.shadowMap.enabled = quality !== '낮음'
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight('#f5f1eb', '#687174', 2.05)
    scene.add(hemi)
    const key = new THREE.DirectionalLight('#fff0d3', 3.7)
    key.position.set(-30, 55, 20)
    key.castShadow = quality !== '낮음'
    key.shadow.mapSize.set(quality === '높음' ? 2048 : 1024, quality === '높음' ? 2048 : 1024)
    scene.add(key)
    const fill = new THREE.PointLight('#d8a477', 1.35, 90)
    fill.position.set(10, 18, 18)
    scene.add(fill)

    const ground = box(scene as unknown as THREE.Group, [120, .35, 160], [0, -.35, 28], '#6e7472')
    ground.receiveShadow = true
    for (let i = -55; i <= 55; i += 5) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, .01, -45), new THREE.Vector3(i, .01, 70)]), new THREE.LineBasicMaterial({ color: '#b4b9b8', transparent: true, opacity: .16 }))
      scene.add(line)
      const line2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-58, .01, -40 + (i + 55) * (140 / 110)), new THREE.Vector3(58, .01, -40 + (i + 55) * (140 / 110))]), new THREE.LineBasicMaterial({ color: '#b4b9b8', transparent: true, opacity: .16 }))
      scene.add(line2)
    }
    scene.add(buildAtriumStructure())
    const campus = new THREE.Group()
    rooms.forEach((room) => campus.add(buildRoom(room)))
    scene.add(campus)

    const avatar = new THREE.Group()
    const avatarCharacter = characterById[avatarCharacterId] ?? characterOptions[0]
    cylinder(avatar, .42, .5, [0, .28, 0], avatarCharacter.color, 24)
    const avatarEmoji = makeEmojiSprite(avatarCharacter.emoji, avatarCharacter.color)
    avatarEmoji.position.y = 1.65
    avatar.add(avatarEmoji)
    const avatarNameTag = makeTextSprite(`${displayName} · 입장 중`, avatarCharacter.color)
    avatarNameTag.scale.set(3.9, .7, 1)
    avatarNameTag.position.y = 2.72
    avatar.add(avatarNameTag)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .04, 8, 28), new THREE.MeshBasicMaterial({ color: accent }))
    ring.rotation.x = Math.PI / 2
    ring.position.y = .06
    avatar.add(ring)
    scene.add(avatar)
    const demoAvatars: Array<[[number, number, number], string, string, string]> = [
      [[-27, .02, -2], 'male-student', '문국찬', '연구 중'],
      [[-17, .02, -2], 'female-student', '윤금순', '승인 기다려요'],
      [[-27, .02, 8], 'male-scientist', '김태영', '작업 중'],
      [[-17, .02, 8], 'male-tech', '김두호', '자료 읽는 중'],
      [[17, .02, 14], 'male-office', '심의준', '자료 읽는 중'],
      [[26, .02, 34], 'female-scientist', '준호', '자료 읽는 중'],
      [[-28, .02, -14], 'male-teacher', '김승환', '지도 중'],
      [[23, .02, -2], 'female-office', '가상 관객', '착석'],
      [[0, .02, 78], 'female-tech', '운동 중', '건강 관리'],
    ]
    demoAvatars.forEach(([position, characterId, label, status]) => scene.add(buildEmojiAvatar(position, characterById[characterId], label, status)))
    avatarRef.current = avatar
    sceneRef.current = scene
    cameraRef.current = camera

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const groundPoint = new THREE.Vector3()
    let draggingAvatar = false
    let draggingCamera = false
    let pointerMoved = false
    let pointerDownX = 0
    let pointerDownY = 0
    let pointerLastX = 0
    let pointerLastY = 0
    let pendingRoomId: string | undefined
    let pendingSeatId: string | undefined
    const moveAvatarToPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      if (!raycaster.ray.intersectPlane(groundPlane, groundPoint)) return
      avatarMoveRef.current([
        Math.max(-55, Math.min(55, groundPoint.x)),
        .05,
        Math.max(-44, Math.min(67, groundPoint.z)),
      ])
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const avatarHit = raycaster.intersectObject(avatar, true)[0]
      if (avatarHit) {
        draggingAvatar = true
        renderer.domElement.setPointerCapture(event.pointerId)
        moveAvatarToPointer(event)
        return
      }
      const hit = raycaster.intersectObjects(campus.children, true)[0]
      pendingRoomId = undefined
      pendingSeatId = undefined
      let node: THREE.Object3D | null = hit?.object ?? null
      let roomId: string | undefined
      let seatId: string | undefined
      if (hit) {
        node = hit.object
        while (node) {
          roomId = roomId ?? node.userData.roomId
          seatId = seatId ?? node.userData.seatId
          node = node.parent
        }
      }
      pendingRoomId = roomId
      pendingSeatId = seatId
      draggingCamera = true
      pointerMoved = false
      pointerDownX = event.clientX
      pointerDownY = event.clientY
      pointerLastX = event.clientX
      pointerLastY = event.clientY
      renderer.domElement.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (draggingAvatar) {
        moveAvatarToPointer(event)
        return
      }
      if (!draggingCamera) return
      const deltaY = event.clientY - pointerDownY
      if (!pointerMoved && Math.abs(event.clientX - pointerDownX) < 4 && Math.abs(deltaY) < 4) return
      pointerMoved = true
      const deltaX = event.clientX - pointerLastX
      const stepY = event.clientY - pointerLastY
      orbitAngleRef.current -= deltaX * .008
      const orbitRadius = distanceRef.current * Math.sqrt(2 + heightScaleRef.current ** 2)
      const floorClearance = .8
      const minimumPitch = Math.asin(Math.max(-.9, Math.min(.9, (floorClearance - targetRef.current.y) / orbitRadius)))
      orbitPitchRef.current = Math.max(minimumPitch, Math.min(1.25, orbitPitchRef.current - stepY * .008))
      pointerLastX = event.clientX
      pointerLastY = event.clientY
    }
    const onPointerUp = (event: PointerEvent) => {
      if (draggingAvatar) draggingAvatar = false
      else if (draggingCamera && !pointerMoved) {
        if (pendingRoomId && pendingSeatId) seatSelectRef.current(pendingRoomId, pendingSeatId)
        else if (pendingRoomId) roomSelectRef.current(pendingRoomId)
        else moveAvatarToPointer(event)
      }
      draggingCamera = false
      pendingRoomId = undefined
      pendingSeatId = undefined
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId)
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const zoomStep = Math.max(-8, Math.min(8, event.deltaY * .045))
      distanceRef.current = Math.max(4, Math.min(112, distanceRef.current + zoomStep))
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    const onResize = () => {
      if (!host || !camera) return
      camera.aspect = host.clientWidth / host.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(host.clientWidth, host.clientHeight)
    }
    window.addEventListener('resize', onResize)
    let frame = 0
    const animate = () => {
      frame = requestAnimationFrame(animate)
      if (avatarRef.current) avatarRef.current.rotation.y += .004
      const distance = distanceRef.current
      const orbitRadius = distance * Math.sqrt(2 + heightScaleRef.current ** 2)
      const angle = orbitAngleRef.current
      const floorClearance = .8
      const minimumPitch = Math.asin(Math.max(-.9, Math.min(.9, (floorClearance - targetRef.current.y) / orbitRadius)))
      const safePitch = Math.max(minimumPitch, Math.min(1.25, orbitPitchRef.current))
      orbitPitchRef.current = safePitch
      const horizontalDistance = orbitRadius * Math.cos(safePitch)
      camera.position.lerp(new THREE.Vector3(targetRef.current.x + horizontalDistance * Math.cos(angle), targetRef.current.y + orbitRadius * Math.sin(safePitch), targetRef.current.z + horizontalDistance * Math.sin(angle)), .045)
      camera.lookAt(targetRef.current)
      renderer.render(scene, camera)
    }
    animate()
    return () => {
      cancelAnimationFrame(frame)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      host.removeChild(renderer.domElement)
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const material = object.material
          if (Array.isArray(material)) material.forEach((item) => item.dispose())
          else material.dispose()
        }
      })
    }
  }, [quality, avatarCharacterId])

  useEffect(() => {
    if (avatarRef.current) avatarRef.current.position.set(...avatarPosition)
  }, [avatarPosition])

  useEffect(() => {
    const room = rooms.find((item) => item.roomId === selectedRoomId)
    if (room) {
      if (room.kind === 'lobby') targetRef.current.set(0, 3.5, 15)
      else targetRef.current.set(room.overviewPosition[0], room.overviewPosition[1] + .7, room.overviewPosition[2])
      distanceRef.current = room.kind === 'lobby' ? 36 : room.kind === 'amphitheater' ? 25 : room.kind === 'garden' ? 28 : room.kind === 'fitness' ? 32 : room.kind === 'professor-lounge' ? 15 : room.kind === 'private-washroom' ? 8 : 12
      heightScaleRef.current = room.kind === 'lobby' ? .12 : .9
      orbitPitchRef.current = Math.atan(heightScaleRef.current / Math.SQRT2)
    }
    sceneRef.current?.traverse((object) => {
      if (object.userData.roomLabel) object.visible = selectedRoomId !== 'lobby' && object.userData.roomId === selectedRoomId
    })
  }, [selectedRoomId])

  useEffect(() => {
    if (resetToken === 0) return
    targetRef.current.set(0, 0, 12)
    distanceRef.current = 52
    heightScaleRef.current = .9
    orbitAngleRef.current = Math.PI / 4
    orbitPitchRef.current = Math.atan(.9 / Math.SQRT2)
  }, [resetToken])

  return <div className="scene-host" ref={hostRef} aria-label="HYCU 3D 연구캠퍼스 공간" />
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'good' | 'warn' | 'neutral' | 'gold' }) {
  return <span className={`status-pill ${tone}`}>{children}</span>
}

function App() {
  const [entered, setEntered] = useState(false)
  const [displayName, setDisplayName] = useState('과목운영책임 교수')
  const [role, setRole] = useState<Role>('professor')
  const [characterId, setCharacterId] = useState('male-teacher')
  const [entryMode, setEntryMode] = useState<EntryMode>('member')
  const [studentNumber, setStudentNumber] = useState('')
  const [visitorName, setVisitorName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [visitorPurpose, setVisitorPurpose] = useState('')
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [roomAccessRequests, setRoomAccessRequests] = useState<RoomAccessRequest[]>([])
  const [accessRoomId, setAccessRoomId] = useState<string | null>(null)
  const [roomChatInput, setRoomChatInput] = useState('')
  const [roomAccessNotice, setRoomAccessNotice] = useState('')
  const [requestStatus, setRequestStatus] = useState('')
  const [adminView, setAdminView] = useState(false)
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPasswordError, setAdminPasswordError] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState('lobby')
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d')
  const [panel, setPanel] = useState<Panel>(null)
  const [search, setSearch] = useState('')
  const [resetToken, setResetToken] = useState(0)
  const [quality, setQuality] = useState<'높음' | '보통' | '낮음'>('보통')
  const [avatarPosition, setAvatarPosition] = useState<[number, number, number]>([0, .05, 3])
  const [occupiedSeat, setOccupiedSeat] = useState<string | null>(null)
  const [seatMessage, setSeatMessage] = useState('좌석을 선택하면 이 기기의 시연 좌석으로 표시됩니다.')
  const [resourceQuery, setResourceQuery] = useState('')
  const [notes, setNotes] = useState<GuidanceNote[]>(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [newSection, setNewSection] = useState('연구질문')
  const [savedMessage, setSavedMessage] = useState('')
  const [coffeeMessage, setCoffeeMessage] = useState('')
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null)
  const [announcementEditor, setAnnouncementEditor] = useState<Announcement | 'new' | null>(null)
  const [presenceCollapsed, setPresenceCollapsed] = useState(false)

  const selectedRoom = rooms.find((room) => room.roomId === selectedRoomId) ?? rooms[0]
  const selectedRole = roleOptions.find((option) => option.id === role) ?? roleOptions[0]
  const selectedCharacter = characterById[characterId] ?? characterOptions[0]
  const canManageAnnouncements = entryMode === 'member' && role === 'professor'
  const sortedAnnouncements = useMemo(() => [...announcements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)), [announcements])
  const applicantName = entryMode === 'visitor' ? visitorName.trim() : selectedRole.name
  const applicantRoleLabel = entryMode === 'visitor' ? '방문자' : selectedRole.label
  const matchingRequest = accessRequests.find((request) => entryMode === 'visitor'
    ? request.kind === 'visitor' && request.name === applicantName && request.phone === phoneNumber.trim()
    : request.kind === 'member' && request.roleId === role && request.studentNumber === studentNumber.trim())
  const activeAttendance = matchingRequest ? attendanceRecords.find((record) => record.requestId === matchingRequest.id) : undefined
  const attendanceCounts = useMemo(() => ({
    current: attendanceRecords.filter((record) => record.status === 'current').length,
    earlyLeave: attendanceRecords.filter((record) => record.status === 'early-leave').length,
    left: attendanceRecords.filter((record) => record.status === 'left').length,
  }), [attendanceRecords])
  const filteredRooms = rooms.filter((room) => `${room.labelKo} ${room.labelEn} ${room.kind}`.toLowerCase().includes(search.toLowerCase()))
  const filteredResources = resourceCatalog.filter((item) => `${item.title} ${item.type} ${item.keywords}`.toLowerCase().includes(resourceQuery.toLowerCase()))
  const accessRoom = rooms.find((room) => room.roomId === accessRoomId) ?? null
  const currentRoomAccessRequest = accessRoom ? roomAccessRequests.find((request) => request.roomId === accessRoom.roomId && request.requesterName === displayName && request.requesterRole === role && request.requesterMode === entryMode) : undefined
  const roomAccessState = (room: RoomSpec, request?: RoomAccessRequest): RoomAccessState => {
    const ownerRole = roomOwnerRole(room)
    if (!ownerRole || (entryMode === 'member' && role === ownerRole)) return 'allowed'
    if (roomNeedsApproval(room)) return request?.status === 'approved' ? 'allowed' : request?.status === 'pending' ? 'pending' : 'approval'
    return 'restricted'
  }
  const demoOccupied = useMemo(() => new Set(['amp-r1-s02', 'amp-r2-s05', 'global-s03', 'lounge-s07']), [])
  const seatIds = useMemo(() => {
    if (selectedRoom.kind === 'amphitheater') return [6, 7, 7].flatMap((count, row) => Array.from({ length: count }, (_, index) => `amp-r${row + 1}-s${String(index + 1).padStart(2, '0')}`))
    if (selectedRoom.kind === 'global') return Array.from({ length: 10 }, (_, i) => `global-s${String(i + 1).padStart(2, '0')}`)
    if (selectedRoom.kind === 'research') return [`${selectedRoom.roomId}-owner`, `${selectedRoom.roomId}-guest01`, `${selectedRoom.roomId}-guest02`]
    if (selectedRoom.kind === 'quiet') return [`${selectedRoom.roomId}-s01`]
    const prefix = selectedRoom.kind === 'lounge' ? 'lounge' : selectedRoom.kind === 'cafe' ? 'cafe' : selectedRoom.kind === 'library' ? 'library' : selectedRoom.kind === 'defense' ? 'defense' : selectedRoom.kind === 'lab' ? 'lab' : selectedRoom.kind === 'garden' ? 'garden' : selectedRoom.kind === 'server' ? 'server' : selectedRoom.kind === 'professor' ? 'prof' : selectedRoom.kind === 'professor-lounge' ? 'faculty' : ''
    return prefix ? Array.from({ length: selectedRoom.seatCount }, (_, i) => `${prefix}-s${String(i + 1).padStart(2, '0')}`) : []
  }, [selectedRoom])

  useEffect(() => {
    const option = roleOptions.find((item) => item.id === role) ?? roleOptions[0]
    setDisplayName(option.name)
    setCharacterId(option.characterId)
  }, [role])

  useEffect(() => {
    const saved = window.localStorage.getItem('hycu-demo-access-requests')
    if (saved) {
      try { setAccessRequests(JSON.parse(saved) as AccessRequest[]) } catch { /* demo data only */ }
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('hycu-demo-attendance-records')
    if (saved) {
      try { setAttendanceRecords(JSON.parse(saved) as AttendanceRecord[]) } catch { /* demo data only */ }
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('hycu-demo-room-access-requests')
    if (saved) {
      try { setRoomAccessRequests(JSON.parse(saved) as RoomAccessRequest[]) } catch { /* demo data only */ }
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('hycu-demo-guidance-notes')
    if (saved) {
      try { setNotes(JSON.parse(saved) as GuidanceNote[]) } catch { /* demo data only */ }
    }
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem('hycu-demo-announcements')
    if (saved) {
      try { setAnnouncements(JSON.parse(saved) as Announcement[]) } catch { /* demo data only */ }
    }
  }, [])

  const moveIntoRoom = (room: RoomSpec) => {
    setSelectedRoomId(room.roomId)
    setPanel(null)
    setAccessRoomId(null)
    setRoomChatInput('')
    setRoomAccessNotice('')
    setOccupiedSeat(null)
    setSeatMessage('좌석을 선택하면 이 기기의 시연 좌석으로 표시됩니다.')
    const offset = room.kind === 'amphitheater' ? 5 : Math.min(room.size[2] / 2 - .8, 2.2)
    setAvatarPosition([room.overviewPosition[0], room.overviewPosition[1] + .05, room.overviewPosition[2] + offset])
  }

  const openRoomAccess = (room: RoomSpec, state: RoomAccessState) => {
    setAccessRoomId(room.roomId)
    setPanel('access')
    setRoomChatInput('')
    setRoomAccessNotice(state === 'restricted'
      ? `${room.owner ?? '담당자'}의 개인 공간입니다. 담당자의 허락 없이는 입장할 수 없습니다.`
      : state === 'pending'
        ? '입장 신청을 보냈습니다. 담당자가 대화창에 “승인”이라고 입력하면 입장할 수 있습니다.'
        : '이 공간은 담당자 승인 후 입장할 수 있습니다. 대화창에 “신청”을 남겨 주세요.')
  }

  const goToRoom = (roomId: string) => {
    const room = rooms.find((item) => item.roomId === roomId)
    if (!room) return
    const request = roomAccessRequests.find((item) => item.roomId === room.roomId && item.requesterName === displayName && item.requesterRole === role && item.requesterMode === entryMode)
    const state = roomAccessState(room, request)
    if (state !== 'allowed') {
      openRoomAccess(room, state)
      return
    }
    moveIntoRoom(room)
  }

  const saveRoomAccessRequests = (next: RoomAccessRequest[]) => {
    setRoomAccessRequests(next)
    window.localStorage.setItem('hycu-demo-room-access-requests', JSON.stringify(next))
  }

  const submitRoomAccessRequest = () => {
    if (!accessRoom) return
    const existing = roomAccessRequests.find((request) => request.roomId === accessRoom.roomId && request.requesterName === displayName && request.requesterRole === role && request.requesterMode === entryMode)
    if (existing?.status === 'approved') {
      moveIntoRoom(accessRoom)
      return
    }
    if (existing?.status === 'pending') {
      setRoomAccessNotice('입장 신청을 보냈습니다. 담당자의 “승인” 답변을 기다리고 있습니다.')
      return
    }
    if (!roomNeedsApproval(accessRoom)) {
      setRoomAccessNotice(`${accessRoom.owner ?? '담당자'}의 개인 공간은 담당자 본인 또는 별도 허락이 있을 때만 입장할 수 있습니다.`)
      return
    }
    const request: RoomAccessRequest = {
      id: Date.now(),
      roomId: accessRoom.roomId,
      requesterName: displayName,
      requesterRole: entryMode === 'member' ? role : null,
      requesterMode: entryMode,
      ownerName: accessRoom.owner ?? '담당자',
      status: 'pending',
      requestText: '신청',
      createdAt: new Date().toLocaleString('ko-KR', { hour12: false }),
    }
    saveRoomAccessRequests([request, ...roomAccessRequests])
    setRoomAccessNotice('대화창에 “신청”을 남겼습니다. 담당자가 “승인”이라고 입력하면 입장할 수 있습니다.')
  }

  const submitRoomAccessResponse = () => {
    if (!accessRoom || !currentRoomAccessRequest || currentRoomAccessRequest.status !== 'pending') return
    const response = roomChatInput.trim()
    if (response !== '승인') {
      setRoomAccessNotice('입장을 허용하려면 담당자가 대화창에 정확히 “승인”이라고 입력해야 합니다.')
      return
    }
    saveRoomAccessRequests(roomAccessRequests.map((request) => request.id === currentRoomAccessRequest.id ? { ...request, status: 'approved', responseText: '승인' } : request))
    setRoomChatInput('')
    setRoomAccessNotice('담당자가 “승인”했습니다. 아래 입장 버튼으로 공간에 들어갈 수 있습니다.')
  }

  const selectRestrictedSeat = (roomId: string, seatId: string) => {
    const room = rooms.find((item) => item.roomId === roomId)
    if (!room) return
    const request = roomAccessRequests.find((item) => item.roomId === room.roomId && item.requesterName === displayName && item.requesterRole === role && item.requesterMode === entryMode)
    if (roomAccessState(room, request) !== 'allowed') {
      openRoomAccess(room, roomAccessState(room, request))
      return
    }
    selectSeat(roomId, seatId)
  }

  const saveAccessRequests = (next: AccessRequest[]) => {
    setAccessRequests(next)
    window.localStorage.setItem('hycu-demo-access-requests', JSON.stringify(next))
  }

  const saveAttendanceRecords = (next: AttendanceRecord[]) => {
    setAttendanceRecords(next)
    window.localStorage.setItem('hycu-demo-attendance-records', JSON.stringify(next))
  }

  const updateAttendanceStatus = (status: AttendanceStatus, request?: AccessRequest) => {
    if (!request) return
    const now = new Date().toLocaleString('ko-KR', { hour12: false })
    const existing = attendanceRecords.find((record) => record.requestId === request.id)
    const nextRecord: AttendanceRecord = {
      id: existing?.id ?? Date.now(),
      requestId: request.id,
      name: request.name,
      roleLabel: request.roleLabel,
      entryMode: request.kind,
      status,
      enteredAt: existing?.enteredAt ?? now,
      changedAt: now,
    }
    const next = existing
      ? attendanceRecords.map((record) => record.requestId === request.id ? nextRecord : record)
      : [nextRecord, ...attendanceRecords]
    saveAttendanceRecords(next)
  }

  const enterApprovedCampus = (request: AccessRequest) => {
    updateAttendanceStatus('current', request)
    setDisplayName(request.name)
    setRequestStatus('')
    setEntered(true)
  }

  const changeMyAttendanceStatus = (status: AttendanceStatus) => {
    if (!matchingRequest || matchingRequest.status !== 'approved') return
    updateAttendanceStatus(status, matchingRequest)
    if (status !== 'current') {
      setEntered(false)
      setPanel(null)
      setRequestStatus(status === 'early-leave' ? '조퇴 처리되었습니다. 다음 입장 전까지 3D 공간에서 나갑니다.' : '하교 처리되었습니다. 오늘의 캠퍼스 이용을 종료합니다.')
    }
  }

  const submitAccessRequest = () => {
    if (matchingRequest?.status === 'approved') {
      enterApprovedCampus(matchingRequest)
      return
    }
    if (matchingRequest?.status === 'pending') {
      setRequestStatus('관리자 확인을 기다리고 있습니다. 관리자 페이지에서 승인해 주세요.')
      return
    }
    if (matchingRequest?.status === 'hold') {
      setRequestStatus('관리자가 신청을 보류했습니다. 관리자 확인이 끝날 때까지 기다려 주세요.')
      return
    }
    if (!applicantName) {
      setRequestStatus('이름을 입력해 주세요.')
      return
    }
    if (entryMode === 'member' && studentNumber.trim().length < 3) {
      setRequestStatus('학번·교직원번호를 입력해 주세요.')
      return
    }
    if (entryMode === 'visitor' && !/^\d{2,4}-?\d{3,4}-?\d{4}$/.test(phoneNumber.trim())) {
      setRequestStatus('방문자 휴대폰 번호를 정확히 입력해 주세요.')
      return
    }
    if (entryMode === 'visitor' && !visitorPurpose.trim()) {
      setRequestStatus('방문목적을 입력해 주세요.')
      return
    }
    if (matchingRequest?.status === 'needs-purpose') {
      const updated = accessRequests.map((request) => request.id === matchingRequest.id ? { ...request, status: 'pending' as const, visitPurpose: visitorPurpose.trim(), createdAt: new Date().toLocaleString('ko-KR', { hour12: false }) } : request)
      saveAccessRequests(updated)
      setRequestStatus('방문목적을 다시 기록했습니다. 관리자가 확인하면 입장할 수 있습니다.')
      return
    }
    const request: AccessRequest = {
      id: Date.now(),
      kind: entryMode,
      roleId: entryMode === 'member' ? role : undefined,
      roleLabel: applicantRoleLabel,
      name: applicantName,
      studentNumber: entryMode === 'member' ? studentNumber.trim() : undefined,
      phone: entryMode === 'visitor' ? phoneNumber.trim() : undefined,
      visitPurpose: entryMode === 'visitor' ? visitorPurpose.trim() : undefined,
      status: 'pending',
      createdAt: new Date().toLocaleString('ko-KR', { hour12: false }),
    }
    saveAccessRequests([request, ...accessRequests])
    setRequestStatus('입장 신청이 접수되었습니다. 관리자가 확인하면 입장할 수 있습니다.')
  }

  const updateAccessRequest = (id: number, status: AccessRequest['status']) => {
    saveAccessRequests(accessRequests.map((request) => request.id === id ? { ...request, status } : request))
  }

  const deleteAccessRequest = (id: number) => {
    if (!window.confirm('이 신청 내역을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) return
    saveAccessRequests(accessRequests.filter((request) => request.id !== id))
  }

  const openAdminGate = () => {
    setAdminView(true)
    setAdminAuthenticated(false)
    setAdminPassword('')
    setAdminPasswordError('')
  }

  const verifyAdminPassword = () => {
    if (adminPassword === '4747') {
      setAdminAuthenticated(true)
      setAdminPasswordError('')
      return
    }
    setAdminPassword('')
    setAdminPasswordError('비밀번호가 맞지 않습니다. 네 자리 숫자를 다시 입력해 주세요.')
  }

  const closeAdminView = () => {
    setAdminView(false)
    setAdminAuthenticated(false)
    setAdminPassword('')
    setAdminPasswordError('')
  }

  const moveAvatar = (dx: number, dz: number) => {
    const next: [number, number, number] = [Math.max(-55, Math.min(55, avatarPosition[0] + dx)), .05, Math.max(-44, Math.min(67, avatarPosition[2] + dz))]
    setAvatarPosition(next)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!entered || viewMode !== '3d' || panel || ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName)) return
      const key = event.key.toLowerCase()
      const speed = event.shiftKey ? 2.2 : 1.15
      if (key === 'w' || key === 'arrowup') { event.preventDefault(); moveAvatar(0, -speed) }
      if (key === 's' || key === 'arrowdown') { event.preventDefault(); moveAvatar(0, speed) }
      if (key === 'a' || key === 'arrowleft') { event.preventDefault(); moveAvatar(-speed, 0) }
      if (key === 'd' || key === 'arrowright') { event.preventDefault(); moveAvatar(speed, 0) }
      if (key === 'escape') { setPanel(null) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const selectSeat = (roomId: string, seatId: string) => {
    setSelectedRoomId(roomId)
    if (demoOccupied.has(seatId)) {
      setSeatMessage('이 좌석은 가상 관객이 사용 중입니다. 실제 접속자 수와 구분된 시연용 상태입니다.')
      setPanel('seat')
      return
    }
    setOccupiedSeat((current) => current === seatId ? null : seatId)
    setSeatMessage(occupiedSeat === seatId ? '좌석에서 일어났습니다.' : `${seatId} 좌석에 앉았습니다. 좌석 상태는 이 기기 안에서만 보이는 데모입니다.`)
    setPanel('seat')
  }

  const saveGuidance = () => {
    if (!newNote.trim()) return
    const isProfessor = entryMode === 'member' && role === 'professor'
    const next = [{ id: Date.now(), author: isProfessor ? '과목운영책임 교수(가상)' : displayName, version: 'v0.4 연구계획서', section: newSection, note: newNote.trim(), status: isProfessor ? '수정 요청' : '검토 중', date: '2026-11-11' }, ...notes]
    setNotes(next)
    window.localStorage.setItem('hycu-demo-guidance-notes', JSON.stringify(next))
    setNewNote('')
    setSavedMessage('지도 의견이 이 브라우저의 시연 기록에 저장되었습니다.')
  }

  const saveAnnouncements = (next: Announcement[]) => {
    setAnnouncements(next)
    window.localStorage.setItem('hycu-demo-announcements', JSON.stringify(next))
  }

  const saveAnnouncement = (draft: Announcement) => {
    if (!canManageAnnouncements) return
    const today = new Date().toLocaleDateString('ko-KR')
    const savedAnnouncement: Announcement = {
      ...draft,
      id: draft.id || Date.now(),
      title: draft.title.trim(),
      category: draft.category.trim() || '캠퍼스 안내',
      author: displayName,
      createdAt: draft.createdAt || today,
      updatedAt: draft.id ? today : undefined,
      content: sanitizeRichText(draft.content),
    }
    const next = announcements.some((announcement) => announcement.id === savedAnnouncement.id)
      ? announcements.map((announcement) => announcement.id === savedAnnouncement.id ? savedAnnouncement : announcement)
      : [savedAnnouncement, ...announcements]
    saveAnnouncements(next)
    setAnnouncementEditor(null)
    setSelectedAnnouncement(savedAnnouncement)
  }

  const deleteAnnouncement = (id: number) => {
    if (!canManageAnnouncements || !window.confirm('이 공지글을 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) return
    saveAnnouncements(announcements.filter((announcement) => announcement.id !== id))
    setSelectedAnnouncement(null)
    setAnnouncementEditor(null)
  }

  const handleSit = () => {
    if (selectedRoom.seatCount > 0) setPanel('seat')
    else setCoffeeMessage('현재 구역에는 착석 좌석이 없습니다. 좌석이 있는 구역으로 이동해 보세요.')
  }

  if (adminView && !adminAuthenticated) return <AdminPasswordScreen password={adminPassword} setPassword={setAdminPassword} error={adminPasswordError} onSubmit={verifyAdminPassword} onBack={closeAdminView} />
  if (adminView) return <AdminPanel requests={accessRequests} attendanceRecords={attendanceRecords} onApprove={(id) => updateAccessRequest(id, 'approved')} onReject={(id) => updateAccessRequest(id, 'rejected')} onHold={(id) => updateAccessRequest(id, 'hold')} onRequestPurpose={(id) => updateAccessRequest(id, 'needs-purpose')} onDelete={deleteAccessRequest} onBack={closeAdminView} />
  if (!entered) return <EntryScreen entryMode={entryMode} setEntryMode={(mode) => { setEntryMode(mode); setRequestStatus('') }} displayName={displayName} visitorName={visitorName} setVisitorName={setVisitorName} studentNumber={studentNumber} setStudentNumber={setStudentNumber} phoneNumber={phoneNumber} setPhoneNumber={setPhoneNumber} visitorPurpose={visitorPurpose} setVisitorPurpose={setVisitorPurpose} role={role} setRole={(nextRole) => { setRole(nextRole); setRequestStatus('') }} roleOptions={roleOptions} selectedCharacter={selectedCharacter} characterId={characterId} setCharacterId={setCharacterId} requestStatus={requestStatus} requestState={matchingRequest?.status ?? null} onSubmit={submitAccessRequest} onAdmin={openAdminGate} />

  return <div className="app-shell reference-style">
    <header className="topbar"><div className="topbar-brand"><div className="brand-mark small">HYCU <span>DRC</span></div><div><strong>박사논문 연구캠퍼스</strong><small>가상 연구캠퍼스 시연</small></div></div><div className="topbar-status"><StatusPill tone="good">● 데모 정상 작동</StatusPill><StatusPill tone="warn">외부 연결 없음</StatusPill><button className="quiet-button" onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}>{viewMode === '3d' ? '2D 접근 화면' : '3D 공간으로 돌아가기'}</button></div></header>
    <div className="workspace">
      <aside className="sidebar left-sidebar"><div className="user-card"><div className="avatar-badge">{selectedCharacter.emoji}</div><div><strong>{displayName}</strong><small>{entryMode === 'visitor' ? '방문자' : selectedRole.label} · {selectedCharacter.label}</small></div><span className="online-dot" /></div><div className="side-section-heading"><span>캠퍼스 구역</span><span className="count-badge">{rooms.length}</span></div><div className="search-box"><span>⌕</span><input placeholder="구역 이름 검색" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="room-list">{filteredRooms.map((room) => <button key={room.roomId} className={`room-item ${selectedRoom.roomId === room.roomId ? 'active' : ''}`} onClick={() => goToRoom(room.roomId)}><span className="room-dot" style={{ backgroundColor: palette[room.theme] ?? accent }} /><span className="room-text"><strong>{room.labelKo}</strong><small>{room.kind === 'fitness' ? '웰니스동' : room.kind === 'private-washroom' ? '개인시설' : room.kind === 'professor-lounge' ? '교수동' : room.kind === 'research' ? '연구동' : room.kind === 'amphitheater' || room.kind === 'global' || room.kind === 'library' ? '학습동' : room.kind === 'lounge' || room.kind === 'cafe' || room.kind === 'garden' || room.kind === 'quiet' ? '교류동' : '연구동'}</small></span>{room.seatCount > 0 && <span className="room-seat-count">{room.seatCount}</span>}</button>)}</div><div className="sidebar-footer"><button className="mini-action" onClick={() => { setResetToken((value) => value + 1); setSelectedRoomId('lobby'); setAvatarPosition([0, .05, 3]) }}>◎ 전체 조망</button><label className="quality-select">화면 품질<select value={quality} onChange={(event) => setQuality(event.target.value as '높음' | '보통' | '낮음')}><option>높음</option><option>보통</option><option>낮음</option></select></label></div></aside>
      <main className="main-stage"><div className="stage-toolbar"><div><span className="eyebrow">CURRENT LOCATION</span><h2>{selectedRoom.labelKo}</h2></div><div className="toolbar-actions"><span className="coord-chip">{selectedRoom.kind === 'lobby' ? '캠퍼스 전체 보기' : '선택 구역 입실'}</span>{selectedRoom.seatCount > 0 && <button className="toolbar-tool" onClick={() => setPanel('seat')}>좌석</button>}{['library', 'professor', 'amphitheater', 'global', 'defense', 'lab', 'research'].includes(selectedRoom.kind) && <button className="toolbar-tool" onClick={() => setPanel('resources')}>자료</button>}{selectedRoom.kind === 'professor' && <button className="toolbar-tool" onClick={() => setPanel('guidance')}>지도</button>}<button className="icon-button" title="카메라 초기화" onClick={() => setResetToken((value) => value + 1)}>↻</button></div></div>{viewMode === '3d' ? <div className="canvas-frame"><SceneView selectedRoomId={selectedRoomId} avatarPosition={avatarPosition} avatarCharacterId={characterId} displayName={displayName} resetToken={resetToken} quality={quality} onRoomSelect={goToRoom} onSeatSelect={selectRestrictedSeat} onAvatarMove={setAvatarPosition} /><div className="canvas-badge"><span className="live-dot" /> 실제 3D 공간 · {rooms.length}개 구역</div><AnnouncementBoard announcements={sortedAnnouncements} canManage={canManageAnnouncements} onOpen={setSelectedAnnouncement} onNew={() => setAnnouncementEditor('new')} /><div className={`visitor-presence ${presenceCollapsed ? 'collapsed' : ''}`} aria-label="현재 입장자 위치"><div className="presence-heading"><span>현재 입장자 위치</span><div className="presence-heading-actions"><small>1명</small><button type="button" className="panel-toggle" aria-expanded={!presenceCollapsed} onClick={() => setPresenceCollapsed((value) => !value)}>{presenceCollapsed ? '펼치기' : '접기'}</button></div></div>{!presenceCollapsed && <div className="presence-list"><div className="presence-person mine"><span className="presence-emoji">{selectedCharacter.emoji}</span><span><strong>{displayName}</strong></span></div></div>}</div><AttendancePanel currentStatus={activeAttendance?.status ?? 'current'} counts={attendanceCounts} onChange={changeMyAttendanceStatus} /><div className="canvas-help"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 이동 <span>·</span> 왼쪽 마우스를 좌우·위아래로 드래그해 화면 이동 <span>·</span> 휠 위·아래로 전체 공간 확대·축소 <span>·</span> 바닥 클릭·끌기로 아바타 이동 <span>·</span> 좌석 클릭</div><div className="reference-controls" aria-label="아바타 이동 조작"><button aria-label="앞으로 이동" onClick={() => moveAvatar(0, -1.15)}>↑</button><div><button aria-label="왼쪽 이동" onClick={() => moveAvatar(-1.15, 0)}>←</button><button className="sit-control" aria-label="앉기" onClick={handleSit}>앉기</button><button aria-label="오른쪽 이동" onClick={() => moveAvatar(1.15, 0)}>→</button></div><button aria-label="뒤로 이동" onClick={() => moveAvatar(0, 1.15)}>↓</button></div><div className="reference-caption">{selectedCharacter.emoji} {displayName} · 머리 위 이름표 · 마우스 이동 가능</div></div> : <TwoDView rooms={rooms} selectedRoomId={selectedRoomId} onRoomSelect={goToRoom} onOpenResources={() => setPanel('resources')} onOpenGuidance={() => setPanel('guidance')} />}</main>
      <aside className="sidebar right-sidebar"><div className="right-heading"><div><span className="eyebrow">ROOM INFORMATION</span><h3>{selectedRoom.labelKo}</h3></div><span className="room-number">{String(rooms.findIndex((room) => room.roomId === selectedRoom.roomId) + 1).padStart(2, '0')} / {rooms.length}</span></div><div className="room-meta"><StatusPill tone={selectedRoom.access === 'public-demo' ? 'good' : 'gold'}>{selectedRoom.kind === 'private-washroom' ? '개인 전용 시연' : selectedRoom.access === 'public-demo' ? '공개 데모 구역' : selectedRoom.access === 'owner-invite' ? '초대 기반 시연' : '참여자 구역'}</StatusPill>{selectedRoom.seatCount > 0 && <span className="seat-meta">⌑ {selectedRoom.seatCount}석</span>}</div><p className="room-description">{selectedRoom.description}</p>{selectedRoom.owner && <div className="owner-line"><span>담당자</span><strong>{selectedRoom.owner}</strong></div>}<div className="feature-list">{selectedRoom.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div><div className="action-stack"><button className="primary-button" onClick={() => goToRoom(selectedRoom.roomId)}>이 구역으로 이동 <span>→</span></button>{selectedRoom.seatCount > 0 && <button className="secondary-button" onClick={() => setPanel('seat')}>좌석 선택 / 일어서기</button>}{['library', 'professor', 'amphitheater', 'global', 'defense', 'lab', 'research'].includes(selectedRoom.kind) && <button className="secondary-button" onClick={() => setPanel('resources')}>자료 열람</button>}{selectedRoom.kind === 'professor' && <button className="secondary-button dark" onClick={() => setPanel('guidance')}>논문지도 열기</button>}{selectedRoom.kind === 'global' && <button className="secondary-button dark" onClick={() => setPanel('connection')}>국제 수업 연결 상태</button>}{selectedRoom.kind === 'cafe' && <button className="secondary-button dark" onClick={() => setCoffeeMessage('따뜻한 커피 한 잔을 준비했습니다. 주문·결제는 연결되지 않은 시연입니다.')}>커피 머신 사용</button>}</div>{coffeeMessage && <div className="toast-note">{coffeeMessage}</div>}<div className="current-state"><div className="state-heading"><span>시연 상태</span><span className="eyebrow">LOCAL DEMO</span></div><div className="state-row"><span>현재 위치</span><strong>{selectedRoom.labelKo}</strong></div><div className="state-row"><span>내 좌석</span><strong>{occupiedSeat ?? '선택하지 않음'}</strong></div><div className="state-row"><span>지도 기록</span><strong>{notes.length}건 저장됨</strong></div></div><div className="connection-notice"><strong>연결이 필요한 기능</strong><span>다중 접속 · 실제 권한 · 음성 · 영상 · 화면 공유</span><small>현재는 외부 서비스 없이 단일 기기 시연으로 표시합니다.</small></div></aside>
    </div>
    {panel === 'access' && accessRoom && <RoomAccessDialog room={accessRoom} accessState={roomAccessState(accessRoom, currentRoomAccessRequest)} request={currentRoomAccessRequest} notice={roomAccessNotice} chatInput={roomChatInput} setChatInput={setRoomChatInput} onRequest={submitRoomAccessRequest} onRespond={submitRoomAccessResponse} onEnter={() => moveIntoRoom(accessRoom)} onClose={() => { setPanel(null); setAccessRoomId(null) }} />}
    {panel && panel !== 'access' && <Dialog panel={panel} selectedRoom={selectedRoom} seatIds={seatIds} demoOccupied={demoOccupied} occupiedSeat={occupiedSeat} seatMessage={seatMessage} onSeatSelect={selectRestrictedSeat} resources={filteredResources} resourceQuery={resourceQuery} setResourceQuery={setResourceQuery} notes={notes} newNote={newNote} setNewNote={setNewNote} newSection={newSection} setNewSection={setNewSection} savedMessage={savedMessage} saveGuidance={saveGuidance} onClose={() => setPanel(null)} role={role} />}
    {selectedAnnouncement && <AnnouncementDetail announcement={selectedAnnouncement} canManage={canManageAnnouncements} onClose={() => setSelectedAnnouncement(null)} onEdit={() => { setAnnouncementEditor(selectedAnnouncement); setSelectedAnnouncement(null) }} onDelete={() => deleteAnnouncement(selectedAnnouncement.id)} />}
    {announcementEditor && <AnnouncementEditor announcement={announcementEditor === 'new' ? null : announcementEditor} displayName={displayName} onClose={() => setAnnouncementEditor(null)} onSave={saveAnnouncement} />}
  </div>
}

type EntryScreenProps = {
  entryMode: EntryMode
  setEntryMode: (mode: EntryMode) => void
  displayName: string
  visitorName: string
  setVisitorName: (value: string) => void
  studentNumber: string
  setStudentNumber: (value: string) => void
  phoneNumber: string
  setPhoneNumber: (value: string) => void
  visitorPurpose: string
  setVisitorPurpose: (value: string) => void
  role: Role
  setRole: (role: Role) => void
  roleOptions: RoleOption[]
  selectedCharacter: CharacterOption
  characterId: string
  setCharacterId: (id: string) => void
  requestStatus: string
  requestState: AccessRequest['status'] | null
  onSubmit: () => void
  onAdmin: () => void
}

function EntryScreen({ entryMode, setEntryMode, displayName, visitorName, setVisitorName, studentNumber, setStudentNumber, phoneNumber, setPhoneNumber, visitorPurpose, setVisitorPurpose, role, setRole, roleOptions, selectedCharacter, characterId, setCharacterId, requestStatus, requestState, onSubmit, onAdmin }: EntryScreenProps) {
  const buttonLabel = requestState === 'approved' ? '관리자 승인 완료 · 캠퍼스 입장' : requestState === 'pending' ? '관리자 확인 중' : requestState === 'hold' ? '관리자 보류 중' : requestState === 'needs-purpose' ? '방문목적 다시 기록하기' : '입장 신청하기'
  const stateMessage = requestState === 'needs-purpose' ? '관리자가 방문목적을 다시 기록해 달라고 요청했습니다.' : requestState === 'hold' ? '관리자가 신청을 보류했습니다. 확인이 끝날 때까지 기다려 주세요.' : ''
  return <div className="entry-screen"><div className="entry-card"><div className="entry-card-top"><div className="brand-mark">HYCU <span>DRC</span></div><button className="admin-link" type="button" onClick={onAdmin}>관리자 페이지</button></div><p className="eyebrow">DOCTORAL RESEARCH CAMPUS</p><h1><span className="title-line">HYCU 부동산대학원</span><span className="title-line"><em>박사논문 연구캠퍼스</em></span></h1><p className="entry-copy">29개 공간을 실제 3D 단층 캠퍼스로 둘러보고, 입장 신청 후 관리자 확인을 거쳐 캠퍼스를 이용합니다.</p><div className="demo-note"><span>시연 전용</span> 신청 정보는 이 브라우저 안에만 저장되며 실제 문자·학교 계정과 연결되지 않습니다.</div><div className="access-mode-tabs"><button type="button" className={entryMode === 'member' ? 'active' : ''} onClick={() => setEntryMode('member')}>교수·연구생</button><button type="button" className={entryMode === 'visitor' ? 'active' : ''} onClick={() => setEntryMode('visitor')}>방문자 신청</button></div>{entryMode === 'member' ? <><label>선택된 입장자 이름<input value={displayName} readOnly /></label><label>입장할 사람 6명 중 선택<select value={role} onChange={(event) => setRole(event.target.value as Role)}>{roleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>학번·교직원번호<input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="학번 또는 교직원번호 입력" /></label></> : <><label>방문자 이름<input value={visitorName} onChange={(event) => setVisitorName(event.target.value)} placeholder="방문자 이름 입력" /></label><label>휴대폰 번호<input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="010-0000-0000" inputMode="tel" /></label><label>방문목적<textarea value={visitorPurpose} onChange={(event) => setVisitorPurpose(event.target.value)} placeholder="방문 목적을 입력해 주세요." rows={3} /></label></>}<div className="character-picker"><div className="character-picker-heading"><span>움직일 사람 이모지 선택</span><small>{selectedCharacter.emoji} {selectedCharacter.label}</small></div><div className="character-grid">{characterOptions.map((character) => <button type="button" key={character.id} className={`character-option ${character.id === characterId ? 'selected' : ''}`} onClick={() => setCharacterId(character.id)} aria-label={`${character.label} 선택`}><span className="character-emoji">{character.emoji}</span><small>{character.label}</small></button>)}</div></div>{(requestStatus || stateMessage) && <div className={`access-status ${requestState ?? 'info'}`}>{requestStatus || stateMessage}</div>}<button className="primary-button entry-button" onClick={onSubmit} disabled={requestState === 'pending' || requestState === 'hold'}>{buttonLabel} <span>→</span></button><div className="entry-footer"><span>관리자 승인 후 입장</span><span>{entryMode === 'member' ? '교수·연구생 6명' : '방문자 신청'}</span><span>외부 연결 없음</span></div></div><div className="entry-glow glow-one" /><div className="entry-glow glow-two" /></div>
}

function AdminPasswordScreen({ password, setPassword, error, onSubmit, onBack }: { password: string; setPassword: (value: string) => void; error: string; onSubmit: () => void; onBack: () => void }) {
  const maskedPassword = '*'.repeat(password.length)
  return <div className="admin-screen"><section className="admin-card admin-gate"><div className="admin-header"><div><div className="brand-mark">HYCU <span>DRC</span></div><p className="eyebrow">CAMPUS ACCESS ADMIN</p><h1>관리자 페이지 입장</h1></div><button className="admin-back" type="button" onClick={onBack}>입장 화면으로</button></div><p className="admin-copy">관리자 비밀번호를 입력하면 입장 신청을 확인할 수 있습니다.</p><form className="admin-password-form" onSubmit={(event) => { event.preventDefault(); onSubmit() }}><label>관리자 비밀번호<span className="password-input-wrap"><input aria-label="관리자 비밀번호" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={password} onChange={(event) => setPassword(event.target.value.replace(/\D/g, '').slice(0, 4))} autoFocus /><span className="password-mask" aria-hidden="true">{maskedPassword || '4자리 비밀번호 입력'}</span></span></label>{error && <div className="password-error" role="alert">{error}</div>}<button className="primary-button" type="submit">관리자 페이지 입장 <span>→</span></button></form><div className="admin-note">비밀번호 입력 내용은 화면에 숫자로 표시되지 않고 입력한 자리마다 `*`로 표시됩니다.</div></section></div>
}

function AttendancePanel({ currentStatus, counts, onChange }: { currentStatus: AttendanceStatus; counts: { current: number; earlyLeave: number; left: number }; onChange: (status: AttendanceStatus) => void }) {
  const statusLabel = currentStatus === 'current' ? '현재 등교 중' : currentStatus === 'early-leave' ? '조퇴 처리됨' : '하교 처리됨'
  return <section className="attendance-panel" aria-label="캠퍼스 출결 상태"><div className="attendance-panel-heading"><div><span className="attendance-kicker">ATTENDANCE</span><strong>캠퍼스 출결 현황</strong></div><span className="attendance-my-status">내 상태 · {statusLabel}</span></div><div className="attendance-blocks"><button type="button" className={`attendance-block current ${currentStatus === 'current' ? 'selected' : ''}`} onClick={() => onChange('current')}><strong>{counts.current}</strong><span>현재 등교인원</span></button><button type="button" className={`attendance-block early ${currentStatus === 'early-leave' ? 'selected' : ''}`} onClick={() => onChange('early-leave')}><strong>{counts.earlyLeave}</strong><span>조퇴인원</span></button><button type="button" className={`attendance-block left ${currentStatus === 'left' ? 'selected' : ''}`} onClick={() => onChange('left')}><strong>{counts.left}</strong><span>하교인원</span></button></div><p className="attendance-panel-hint">현재 등교 상태로 3D 공간을 이용하며, 조퇴·하교 블록을 누르면 이용을 종료합니다.</p></section>
}

function AnnouncementBoard({ announcements, canManage, onOpen, onNew }: { announcements: Announcement[]; canManage: boolean; onOpen: (announcement: Announcement) => void; onNew: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  return <aside className={`notice-board ${collapsed ? 'collapsed' : ''}`} aria-label="알림터 통합게시판"><div className="notice-board-header"><div><span className="notice-board-kicker">CAMPUS NOTICE</span><strong>알림터 통합게시판</strong></div><div className="notice-board-actions"><span className="notice-board-count">{announcements.length}건</span>{canManage && <button type="button" className="notice-new-button" onClick={onNew}>+ 새 공지</button>}<button type="button" className="panel-toggle" aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>{collapsed ? '펼치기' : '접기'}</button></div></div>{!collapsed && <><div className="notice-list">{announcements.length === 0 ? <div className="notice-empty">등록된 공지글이 없습니다.</div> : announcements.map((announcement) => <button type="button" className="notice-item" key={announcement.id} onClick={() => onOpen(announcement)}><span className="notice-item-pin">{announcement.pinned ? '📌' : '•'}</span><span className="notice-item-body"><strong>{announcement.title}</strong><small>{announcement.category} · {announcement.author}</small></span><time dateTime={announcement.createdAt}>{announcement.createdAt.slice(5)}</time></button>)}</div><p className="notice-board-hint">제목을 클릭하면 공지 내용을 확인할 수 있습니다.</p></>}</aside>
}

function AnnouncementDetail({ announcement, canManage, onClose, onEdit, onDelete }: { announcement: Announcement; canManage: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog-card announcement-detail" role="dialog" aria-modal="true" aria-labelledby="announcement-detail-title"><div className="dialog-header"><div><span className="eyebrow">{announcement.category}</span><h3 id="announcement-detail-title">{announcement.title}</h3><p className="announcement-meta">{announcement.author} · {announcement.createdAt}{announcement.updatedAt ? ` · 수정 ${announcement.updatedAt}` : ''}</p></div><button className="close-button" onClick={onClose} aria-label="공지 닫기">×</button></div><div className="announcement-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(announcement.content) }} /><div className="announcement-actions"><button type="button" className="secondary-button" onClick={onClose}>목록으로</button>{canManage && <><button type="button" className="secondary-button" onClick={onEdit}>수정</button><button type="button" className="delete-button" onClick={onDelete}>삭제</button></>}</div></section></div>
}

function RichTextToolbar() {
  const runCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
  }
  const buttons: Array<{ label: string; command: string; value?: string; title: string }> = [
    { label: '굵게', command: 'bold', title: '굵게' },
    { label: '기울임', command: 'italic', title: '기울임' },
    { label: '밑줄', command: 'underline', title: '밑줄' },
    { label: '제목', command: 'formatBlock', value: 'h2', title: '제목 크기' },
    { label: '본문', command: 'formatBlock', value: 'p', title: '본문 크기' },
    { label: '• 목록', command: 'insertUnorderedList', title: '글머리표 목록' },
    { label: '1. 목록', command: 'insertOrderedList', title: '번호 목록' },
    { label: '왼쪽', command: 'justifyLeft', title: '왼쪽 정렬' },
    { label: '가운데', command: 'justifyCenter', title: '가운데 정렬' },
    { label: '오른쪽', command: 'justifyRight', title: '오른쪽 정렬' },
  ]
  return <div className="rich-toolbar" aria-label="공지글 편집 도구">{buttons.map((button) => <button type="button" key={`${button.command}-${button.value ?? button.label}`} title={button.title} onMouseDown={(event) => { event.preventDefault(); runCommand(button.command, button.value) }}>{button.label}</button>)}<button type="button" title="링크 넣기" onMouseDown={(event) => { event.preventDefault(); const url = window.prompt('연결할 주소를 입력해 주세요.'); if (url && /^(https?:\/\/|mailto:)/i.test(url)) runCommand('createLink', url) }}>링크</button></div>
}

function AnnouncementEditor({ announcement, displayName, onClose, onSave }: { announcement: Announcement | null; displayName: string; onClose: () => void; onSave: (announcement: Announcement) => void }) {
  const [title, setTitle] = useState(announcement?.title ?? '')
  const [category, setCategory] = useState(announcement?.category ?? '캠퍼스 안내')
  const [pinned, setPinned] = useState(announcement?.pinned ?? false)
  const [content, setContent] = useState(announcement?.content ?? '<h2>공지 제목</h2><p>공지 내용을 입력해 주세요.</p>')
  const [error, setError] = useState('')
  const editorKey = announcement?.id ?? 'new'
  const submit = () => {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (!title.trim()) { setError('공지 제목을 입력해 주세요.'); return }
    if (!plainText) { setError('공지 내용을 입력해 주세요.'); return }
    onSave({ id: announcement?.id ?? 0, category, title, author: displayName, createdAt: announcement?.createdAt ?? '', updatedAt: announcement?.updatedAt, content: sanitizeRichText(content), pinned })
  }
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog-card announcement-editor" role="dialog" aria-modal="true" aria-labelledby="announcement-editor-title"><div className="dialog-header"><div><span className="eyebrow">NOTICE EDITOR</span><h3 id="announcement-editor-title">{announcement ? '공지글 수정' : '새 공지글 작성'}</h3></div><button className="close-button" onClick={onClose} aria-label="편집 닫기">×</button></div><div className="announcement-form"><label>공지 제목<input className="announcement-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="공지 제목을 입력해 주세요." autoFocus /></label><div className="announcement-form-row"><label>분류<select value={category} onChange={(event) => setCategory(event.target.value)}><option>캠퍼스 안내</option><option>논문지도</option><option>시설 이용</option><option>수업 일정</option><option>기타</option></select></label><label className="pin-check"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> 상단 고정</label></div><div className="rich-editor-label">공지 내용</div><RichTextToolbar /><div key={editorKey} className="rich-editor" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }} onInput={(event) => setContent(event.currentTarget.innerHTML)} role="textbox" aria-label="공지 내용 편집" />{error && <div className="announcement-status" role="alert">{error}</div>}<div className="announcement-editor-note">작성자: {displayName} · 저장 내용은 이 브라우저의 시연 기록에 보관됩니다.</div><div className="announcement-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="button" className="primary-button" onClick={submit}>공지 저장 <span>→</span></button></div></div></section></div>
}

function RoomAccessDialog({ room, accessState, request, notice, chatInput, setChatInput, onRequest, onRespond, onEnter, onClose }: { room: RoomSpec; accessState: RoomAccessState; request?: RoomAccessRequest; notice: string; chatInput: string; setChatInput: (value: string) => void; onRequest: () => void; onRespond: () => void; onEnter: () => void; onClose: () => void }) {
  const statusLabel = accessState === 'restricted' ? '개인 전용' : accessState === 'pending' ? '승인 대기' : accessState === 'allowed' ? '승인 완료' : '입장 신청 필요'
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog-card access-dialog"><div className="dialog-header"><div><span className="eyebrow">PRIVATE ACCESS CHAT</span><h3>{room.labelKo}</h3></div><button className="close-button" onClick={onClose}>×</button></div><div className="access-panel"><div className="access-room-meta"><span>담당자</span><strong>{room.owner ?? '담당자'}</strong><b className={`access-state-badge ${accessState}`}>{statusLabel}</b></div><div className="dialog-note">독립된 공간은 담당자의 허락 없이는 입장할 수 없습니다. 교수실과 연구실은 대화창에 <strong>신청</strong>을 남긴 뒤 담당자가 <strong>승인</strong>해야 입장할 수 있습니다.</div><div className="access-chat" aria-label="공간 입장 대화창"><div className="chat-bubble requester"><small>{request?.requesterName ?? '현재 입장자'}</small><strong>{request?.requestText ?? '아직 입장 신청 전'}</strong></div>{request?.responseText && <div className="chat-bubble owner"><small>{request.ownerName}</small><strong>{request.responseText}</strong></div>}</div>{notice && <div className="room-access-notice">{notice}</div>}{accessState === 'restricted' && <div className="access-denied-note">이 공간은 해당 담당자만 사용하는 독립 공간입니다. 타인의 화장실·샤워실·개인 휴게실에는 입장할 수 없습니다.</div>}{accessState === 'approval' && <button className="primary-button access-action" onClick={onRequest}>대화창에 “신청” 보내기 <span>→</span></button>}{accessState === 'pending' && <><label className="chat-response-field">담당자 답변 입력<input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="승인" /></label><button className="primary-button access-action" onClick={onRespond}>담당자 답변 보내기 <span>→</span></button></>}{accessState === 'allowed' && <button className="primary-button access-action" onClick={onEnter}>승인된 공간으로 입장 <span>→</span></button>}</div></section></div>
}

function AdminPanel({ requests, attendanceRecords, onApprove, onReject, onHold, onRequestPurpose, onDelete, onBack }: { requests: AccessRequest[]; attendanceRecords: AttendanceRecord[]; onApprove: (id: number) => void; onReject: (id: number) => void; onHold: (id: number) => void; onRequestPurpose: (id: number) => void; onDelete: (id: number) => void; onBack: () => void }) {
  const waitingStatuses: AccessRequest['status'][] = ['pending', 'hold', 'needs-purpose']
  const pendingCount = requests.filter((request) => waitingStatuses.includes(request.status)).length
  const attendanceCounts = {
    current: attendanceRecords.filter((record) => record.status === 'current').length,
    earlyLeave: attendanceRecords.filter((record) => record.status === 'early-leave').length,
    left: attendanceRecords.filter((record) => record.status === 'left').length,
  }
  const statusLabel = (status: AccessRequest['status']) => status === 'pending' ? '확인 대기' : status === 'approved' ? '승인 완료' : status === 'rejected' ? '거절됨' : status === 'hold' ? '보류' : '방문목적 재기록 요청'
  return <div className="admin-screen"><section className="admin-card"><div className="admin-header"><div><div className="brand-mark">HYCU <span>DRC</span></div><p className="eyebrow">CAMPUS ACCESS ADMIN</p><h1>입장 신청 관리자 확인</h1></div><button className="admin-back" type="button" onClick={onBack}>입장 화면으로</button></div><p className="admin-copy">교수·연구생과 방문자의 신청을 확인하고 각 신청 블록에서 승인, 거절, 방문목적 재기록 요청, 보류, 삭제를 처리합니다.</p><div className="admin-summary"><div><span>전체 신청</span><strong>{requests.length}</strong></div><div><span>확인 대기</span><strong>{pendingCount}</strong></div><div><span>승인 완료</span><strong>{requests.filter((request) => request.status === 'approved').length}</strong></div></div><div className="attendance-admin-blocks" aria-label="출결 인원 집계"><div className="attendance-admin-block current"><span>현재 등교인원</span><strong>{attendanceCounts.current}</strong><small>현재 3D 공간 이용 중</small></div><div className="attendance-admin-block early"><span>조퇴인원</span><strong>{attendanceCounts.earlyLeave}</strong><small>조퇴 처리된 인원</small></div><div className="attendance-admin-block left"><span>하교인원</span><strong>{attendanceCounts.left}</strong><small>오늘 이용을 종료한 인원</small></div></div>{attendanceRecords.length > 0 && <div className="attendance-admin-list"><div className="attendance-admin-list-heading"><strong>출결 상태 명단</strong><span>3D 공간에서 본인이 상태를 변경합니다.</span></div>{attendanceRecords.map((record) => <div className="attendance-admin-row" key={record.id}><span><strong>{record.name}</strong><small>{record.roleLabel}</small></span><b className={`attendance-badge ${record.status}`}>{record.status === 'current' ? '현재 등교' : record.status === 'early-leave' ? '조퇴' : '하교'}</b><time>{record.changedAt}</time></div>)}</div>}{requests.length === 0 ? <div className="admin-empty">아직 입장 신청이 없습니다. 입장 화면에서 신청을 먼저 접수해 주세요.</div> : <div className="admin-request-list">{requests.map((request) => <article className="admin-request" key={request.id}><div className="admin-request-main"><div className="admin-request-title"><strong>{request.name}</strong><span className={`request-badge ${request.status}`}>{statusLabel(request.status)}</span></div><p>{request.roleLabel}</p><small>{request.kind === 'member' ? `학번·교직원번호: ${request.studentNumber}` : `휴대폰: ${request.phone}`} · 신청일시: {request.createdAt}</small>{request.kind === 'visitor' && <div className="visit-purpose-line"><span>방문목적</span><strong>{request.visitPurpose || '아직 기록되지 않음'}</strong></div>}</div><div className="admin-request-actions"><button type="button" className="approve-button" onClick={() => onApprove(request.id)}>승인</button><button type="button" className="reject-button" onClick={() => onReject(request.id)}>거절</button>{request.kind === 'visitor' && <button type="button" className="purpose-button" onClick={() => onRequestPurpose(request.id)}>방문목적 다시 요청</button>}<button type="button" className="hold-button" onClick={() => onHold(request.id)}>보류</button><button type="button" className="delete-button" onClick={() => onDelete(request.id)}>신청 내역 삭제</button></div></article>)}</div>}<div className="admin-note">현재는 외부 서버 없이 이 브라우저의 시연 기록으로만 관리됩니다. 삭제한 신청 내역은 이 브라우저에서 제거되며, 실제 운영에서는 로그인·권한·서버 저장·문자 알림 연결이 필요합니다.</div></section></div>
}

function TwoDView({ rooms, selectedRoomId, onRoomSelect, onOpenResources, onOpenGuidance }: { rooms: RoomSpec[]; selectedRoomId: string; onRoomSelect: (id: string) => void; onOpenResources: () => void; onOpenGuidance: () => void }) {
  return <div className="two-d-view"><div className="two-d-intro"><div><span className="eyebrow">ACCESSIBLE 2D VIEW</span><h3>3D를 실행하지 못해도 같은 자료와 이동 흐름을 확인할 수 있습니다.</h3><p>구역을 누르면 시연 위치가 바뀌고, 아래 버튼으로 자료와 논문지도를 열 수 있습니다.</p></div><div className="two-d-actions"><button className="secondary-button" onClick={onOpenResources}>자료 열람</button><button className="secondary-button dark" onClick={onOpenGuidance}>논문지도</button></div></div><div className="floor-map"><div className="map-grid-lines" />{rooms.map((room) => <button key={room.roomId} className={`map-room ${selectedRoomId === room.roomId ? 'selected' : ''} ${room.kind}`} style={{ left: `${50 + room.overviewPosition[0] * .72}%`, top: `${42 + room.overviewPosition[2] * .7}%` }} onClick={() => onRoomSelect(room.roomId)}><span>{room.labelKo.replace('·', ' ')}</span>{room.seatCount > 0 && <small>{room.seatCount}석</small>}</button>)}</div></div>
}

function Dialog({ panel, selectedRoom, seatIds, demoOccupied, occupiedSeat, seatMessage, onSeatSelect, resources, resourceQuery, setResourceQuery, notes, newNote, setNewNote, newSection, setNewSection, savedMessage, saveGuidance, onClose, role }: { panel: Panel; selectedRoom: RoomSpec; seatIds: string[]; demoOccupied: Set<string>; occupiedSeat: string | null; seatMessage: string; onSeatSelect: (roomId: string, seatId: string) => void; resources: Resource[]; resourceQuery: string; setResourceQuery: (value: string) => void; notes: GuidanceNote[]; newNote: string; setNewNote: (value: string) => void; newSection: string; setNewSection: (value: string) => void; savedMessage: string; saveGuidance: () => void; onClose: () => void; role: Role }) {
  const title = panel === 'resources' ? '가상 연구자료 열람' : panel === 'guidance' ? '논문지도 기록' : panel === 'seat' ? `${selectedRoom.labelKo} 좌석` : '국제 수업 연결 상태'
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="dialog-card"><div className="dialog-header"><div><span className="eyebrow">{panel === 'guidance' ? 'GUIDANCE DESK' : panel === 'seat' ? 'SEAT MAP' : 'DEMO PANEL'}</span><h3>{title}</h3></div><button className="close-button" onClick={onClose}>×</button></div>{panel === 'resources' && <div className="resource-panel"><div className="dialog-note">실제 논문 원문이 아닌 가상 자료입니다. 출처와 접근 범위를 함께 표시합니다.</div><div className="search-box wide"><span>⌕</span><input placeholder="제목·키워드 검색" value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} /></div><div className="resource-list">{resources.map((item) => <article className="resource-card" key={item.title}><div className="resource-type">{item.type} · {item.year}</div><h4>{item.title}</h4><p>{item.keywords}</p><div><span>{item.access}</span><small>{item.source}</small></div><button className="text-button" onClick={() => window.alert(`${item.title}\n\n${item.source}\n\n가상 자료 열람 화면입니다.`)}>자료 열기 →</button></article>)}{resources.length === 0 && <div className="empty-state">검색 결과가 없습니다.</div>}</div></div>}{panel === 'seat' && <div className="seat-panel"><div className="dialog-note">실제 사용자와 가상 관객을 구분합니다. 이 화면의 좌석 상태는 단일 기기 시연용입니다.</div><p className="seat-message">{seatMessage}</p><div className="seat-grid">{seatIds.map((id) => { const isDemo = demoOccupied.has(id); const isMine = occupiedSeat === id; return <button key={id} className={`seat-button ${isDemo ? 'demo-occupied' : ''} ${isMine ? 'mine' : ''}`} onClick={() => onSeatSelect(selectedRoom.roomId, id)}><span>{isMine ? '내 좌석' : isDemo ? '가상 관객' : '빈 좌석'}</span><strong>{id}</strong></button> })}</div>{selectedRoom.kind === 'amphitheater' && <div className="seat-legend"><span><i className="my-seat" /> 내 좌석</span><span><i className="demo-seat" /> 가상 관객</span><span><i className="empty-seat" /> 빈 좌석</span></div>}</div>}{panel === 'guidance' && <div className="guidance-panel"><div className="guidance-summary"><div><span>논문 버전</span><strong>v0.3 연구계획서</strong></div><div><span>다음 지도일</span><strong>2026. 11. 18. 19:00</strong></div><div><span>상태 의미</span><strong>학위 합격과 무관</strong></div></div><div className="guidance-form"><div className="form-row"><label>대상 절/페이지<select value={newSection} onChange={(event) => setNewSection(event.target.value)}><option>연구질문</option><option>1장 서론</option><option>2장 선행연구</option><option>3장 연구방법</option></select></label></div><label>지도 의견<textarea value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder={role === 'professor' ? '연구생에게 전달할 의견을 적어 보세요.' : '지도교수에게 전달할 연구 메모를 적어 보세요.'} rows={3} /></label><button className="primary-button" onClick={saveGuidance}>시연 기록 저장 <span>→</span></button>{savedMessage && <div className="success-note">{savedMessage}</div>}</div><div className="notes-list">{notes.map((note) => <article className="note-card" key={note.id}><div className="note-top"><strong>{note.author}</strong><span>{note.status}</span></div><p>{note.note}</p><small>{note.version} · {note.section} · {note.date}</small></article>)}</div><div className="dialog-note">현재는 이 브라우저의 시연 기록으로 저장됩니다. 실제 계정·파일·권한 연결은 아직 설정되지 않았습니다.</div></div>}{panel === 'connection' && <div className="connection-panel"><div className="connection-hero"><span className="connection-icon">◎</span><div><h4>국제 수업 연결 준비 전</h4><p>한·영 화면, 시간대 표시, 초대 흐름은 시연되지만 음성·영상·화면 공유는 아직 연결되지 않았습니다.</p></div></div><div className="connection-list"><div><span>마이크·카메라</span><StatusPill tone="warn">연결 설정 필요</StatusPill></div><div><span>화면 공유</span><StatusPill tone="warn">연결 설정 필요</StatusPill></div><div><span>자동 번역·자막</span><StatusPill tone="neutral">미구현</StatusPill></div><div><span>대체 경로</span><StatusPill tone="good">자료 패널 사용 가능</StatusPill></div></div><div className="time-zone-card"><span>참가자 시간대 예시</span><strong>서울 19:00 · 런던 10:00 · 뉴욕 05:00</strong><small>사용자가 선택한 표시값을 보여주는 예시입니다. 자동 수집하지 않습니다.</small></div></div>}</section></div>
}

export default App
