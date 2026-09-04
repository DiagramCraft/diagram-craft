import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type { DiagramEntityRefDatabase } from './diagramEntityRefDatabase';
import {
  DIAGRAM_ENTITY_FILE_SELECT_SQL,
  diagramEntityFileMapper
} from './diagramEntityRefDatabase';

export class SqliteDiagramEntityRefDatabase
  extends SqliteDatabaseBase
  implements DiagramEntityRefDatabase
{
  async syncDiagramEntityRefs(workspace: string, fileId: string, entityIds: string[]) {
    const tx = this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM diagram_entity_ref WHERE workspace = ? AND file_id = ?')
        .run(workspace, fileId);
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO diagram_entity_ref (workspace, file_id, entity_id) VALUES (?, ?, ?)'
      );
      for (const entityId of entityIds) {
        insert.run(workspace, fileId, entityId);
      }
    });
    tx();
  }

  async getEntityDiagramFiles(workspace: string, entityId: string) {
    return this.all(
      `${DIAGRAM_ENTITY_FILE_SELECT_SQL}
      WHERE der.workspace = ? AND der.entity_id = ?
      ORDER BY COALESCE(p.name, ''), pf.name`,
      [workspace, entityId],
      diagramEntityFileMapper
    );
  }
}
