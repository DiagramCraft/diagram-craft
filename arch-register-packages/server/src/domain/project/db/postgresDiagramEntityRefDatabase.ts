import {
  normalizePostgresError,
  PostgresDatabaseBase,
  withPostgresTransaction
} from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type { DiagramEntityRefDatabase } from './diagramEntityRefDatabase';
import {
  DIAGRAM_ENTITY_FILE_SELECT_SQL,
  diagramEntityFileMapper
} from './diagramEntityRefDatabase';

export class PostgresDiagramEntityRefDatabase
  extends PostgresDatabaseBase
  implements DiagramEntityRefDatabase
{
  async syncDiagramEntityRefs(workspace: string, fileId: string, entityIds: string[]) {
    try {
      await withPostgresTransaction(this.sql, async tx => {
        await tx`
          DELETE FROM diagram_entity_ref
          WHERE workspace = ${workspace} AND file_id = ${fileId}
        `;
        for (const entityId of entityIds) {
          await tx`
            INSERT INTO diagram_entity_ref (workspace, file_id, entity_id)
            VALUES (${workspace}, ${fileId}, ${entityId})
            ON CONFLICT DO NOTHING
          `;
        }
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getEntityDiagramFiles(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${DIAGRAM_ENTITY_FILE_SELECT_SQL}
       WHERE der.workspace = $1 AND der.entity_id = $2
       ORDER BY COALESCE(p.name, ''), pf.name`,
      [workspace, entityId]
    );
    return mapDatabaseRows(rows, diagramEntityFileMapper);
  }
}
