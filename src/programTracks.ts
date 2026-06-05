export type TrackId = 'enterprise' | 'founders' | 'personal'

export type ProgramTrack = {
  id: TrackId
  label: string
  shortLabel: string
  chips: string[]
  color: string
  mutedColor: string
  pathNodes: string[]
  calendarDates: number[]
}

export const PROGRAM_TRACKS: ProgramTrack[] = [
  {
    id: 'enterprise',
    label: 'Enterprise',
    shortLabel: 'enterprise',
    chips: ['C-level', 'HRD', 'ops'],
    color: '#1f9e78',
    mutedColor: '#c7eee3',
    pathNodes: ['prereq', 'enterprise', 'routing', 'core', 'team', 'artifacts', 'memory'],
    calendarDates: [6, 10, 13, 17, 20, 24, 26, 27],
  },
  {
    id: 'founders',
    label: 'Founders / SMB',
    shortLabel: 'founders / smb',
    chips: ['founder', 'COO', 'growth'],
    color: '#2f66f3',
    mutedColor: '#dfe8ff',
    pathNodes: ['prereq', 'founders', 'routing', 'core', 'automation', 'strategy', 'artifacts', 'memory'],
    calendarDates: [6, 9, 12, 15, 18, 22, 26, 27],
  },
  {
    id: 'personal',
    label: 'Micro / personal',
    shortLabel: 'micro / personal',
    chips: ['solo', 'expert', 'personal OS'],
    color: '#e38a2e',
    mutedColor: '#f8e2c8',
    pathNodes: ['prereq', 'personal', 'routing', 'core', 'personal-system', 'automation', 'artifacts', 'memory'],
    calendarDates: [6, 8, 11, 16, 19, 22, 25, 26, 27],
  },
]

export const TRACK_BY_ID = Object.fromEntries(PROGRAM_TRACKS.map((track) => [track.id, track])) as Record<TrackId, ProgramTrack>

export const TRACK_LABELS: Record<TrackId, string> = {
  enterprise: 'Enterprise',
  founders: 'Founders / SMB',
  personal: 'Micro / personal',
}
