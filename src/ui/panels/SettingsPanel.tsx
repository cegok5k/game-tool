import styles from './SettingsPanel.module.css'
import { useProjectStore } from '../../stores/projectStore'
import { getPlatform } from '../../platform'
import { KEY_CANDIDATES as IMAGEN_KEY_CANDIDATES } from '../../ai/imagenProvider'

type AiKey = {
  /** Candidate env var names; first found wins. Displayed joined by " or ". */
  candidates: readonly string[]
  description: string
}

const AI_KEYS: readonly AiKey[] = [
  { candidates: IMAGEN_KEY_CANDIDATES, description: 'Imagen 3 image generation' },
  { candidates: ['CEGO_VEO_API_KEY', 'GOOGLE_VEO_API_KEY'],           description: 'Veo 3 video generation (not yet wired)' },
  { candidates: ['CEGO_SEEDANCE_API_KEY', 'GOOGLE_SEEDANCE_API_KEY'], description: 'Seedance animation (not yet wired)' },
]

export function SettingsPanel() {
  const folder = useProjectStore((s) => s.folder)
  const projectName = useProjectStore((s) => s.projectName)
  const balanceTypes = useProjectStore((s) => s.balanceTypes)
  const spineVersion = useProjectStore((s) => s.spineVersion)
  const devPortOffset = useProjectStore((s) => s.devPortOffset)
  const platform = getPlatform()

  return (
    <div className={styles.wrap}>
      <Section title="Project">
        {folder === null ? (
          <div className={styles.empty}>No project open. Use &ldquo;Open Project&rdquo; in the menu bar.</div>
        ) : (
          <>
            <Row label="Name">{projectName ?? folder.name}</Row>
            <Row label="Folder">{folder.rootPath}</Row>
            {spineVersion !== null && <Row label="Spine version">{spineVersion}</Row>}
            {devPortOffset !== null && <Row label="Dev port">{3000 + devPortOffset}</Row>}
            {balanceTypes.length > 0 && <Row label="Balance types">{balanceTypes.join(', ')}</Row>}
          </>
        )}
      </Section>

      <Section title="Platform">
        <Row label="Kind">{platform.kind}</Row>
      </Section>

      <Section title="AI providers">
        {AI_KEYS.map((k) => {
          const matched = k.candidates.find((c) => platform.env.has(c))
          const present = matched !== undefined
          return (
            <div key={k.candidates[0]} data-key-row="" data-present={present} className={styles['key-row']}>
              <span className={styles.dot} />
              <span className={styles['key-name']}>{present ? matched : k.candidates.join(' or ')}</span>
              <span className={styles['key-desc']}>{present ? k.description : `${k.description} — env var not set`}</span>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{children}</span>
    </div>
  )
}
