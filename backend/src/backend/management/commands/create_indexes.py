"""Create database indexes for performance optimization."""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Creates database indexes for performance optimization'

    INDEXES = [
        # Core indexes
        {
            'name': 'ix_step_result',
            'table': 'backend_step_result',
            'columns': ['feature_result_id'],
            'sql': 'CREATE INDEX IF NOT EXISTS ix_step_result ON public.backend_step_result USING btree (feature_result_id)'
        },
        {
            'name': 'ix_app_env_feat',
            'table': 'backend_feature_result',
            'columns': ['feature_id_id', 'app_id', 'app_name', 'environment_id', 'environment_name'],
            'sql': 'CREATE INDEX IF NOT EXISTS ix_app_env_feat ON public.backend_feature_result USING btree (feature_id_id, app_id, app_name, environment_id, environment_name)'
        },
        {
            'name': 'ix_browser',
            'table': 'backend_feature_result',
            'columns': ['browser'],
            'sql': 'CREATE INDEX IF NOT EXISTS ix_browser ON public.backend_feature_result USING btree (browser)'
        },
        {
            'name': 'ix_dep',
            'table': 'backend_feature_result',
            'columns': ['department_id'],
            'sql': 'CREATE INDEX IF NOT EXISTS ix_dep ON public.backend_feature_result USING btree (department_id)'
        },
        
        # Performance indexes
        {
            'name': 'idx_feature_result_feature_date',
            'table': 'backend_feature_result',
            'columns': ['feature_id_id', 'result_date'],
            'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feature_result_feature_date ON public.backend_feature_result USING btree (feature_id_id, result_date)'
        },
        {
            'name': 'idx_step_result_name_feature',
            'table': 'backend_step_result',
            'columns': ['step_name', 'feature_result_id'],
            'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_step_result_name_feature ON public.backend_step_result USING btree (step_name, feature_result_id)'
        },
        {
            'name': 'idx_step_result_feature_result_id',
            'table': 'backend_step_result',
            'columns': ['feature_result_id'],
            'where': 'feature_result_id IS NOT NULL',
            'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_step_result_feature_result_id ON public.backend_step_result USING btree (feature_result_id) WHERE feature_result_id IS NOT NULL'
        },
        {
            'name': 'idx_feature_result_date_desc',
            'table': 'backend_feature_result',
            'columns': ['result_date DESC'],
            'sql': 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feature_result_date_desc ON public.backend_feature_result USING btree (result_date DESC)'
        }
    ]

    def handle(self, *args, **options):
        self.stdout.write("┌─────────────────────────────────────────────────────────────────────┐")
        self.stdout.write("│ Creating database indexes...                                         │")
        self.stdout.write("└─────────────────────────────────────────────────────────────────────┘")
        
        success_count = 0
        
        for i, index in enumerate(self.INDEXES, 1):
            self.stdout.write(f"│")
            self.stdout.write(f"│ [{i}] Creating index: {index['name']}")
            self.stdout.write(f"│     Table: {index['table']}")
            self.stdout.write(f"│     Columns: {', '.join(index['columns'])}")
            
            if index.get('where'):
                self.stdout.write(f"│     Condition: {index['where']}")
                
            self.stdout.write(f"│     Status: ", ending='')
            
            try:
                with connection.cursor() as cursor:
                    cursor.execute(index['sql'])
                self.stdout.write("✅ SUCCESS")
                success_count += 1
            except Exception as e:
                error_msg = str(e)
                if 'already exists' in error_msg.lower():
                    self.stdout.write("✓ Already exists (skipped)")
                    success_count += 1
                else:
                    self.stdout.write("❌ FAILED")
                    self.stdout.write(f"│     Error: {error_msg.split(chr(10))[0]}")
        
        self.stdout.write(f"│")
        self.stdout.write(f"├─────────────────────────────────────────────────────────────────────┤")
        summary_text = f"{success_count}/{len(self.INDEXES)} indexes verified successfully"
        padding = 69 - len("Summary: ") - len(summary_text)
        self.stdout.write(f"│ Summary: {summary_text}{' ' * padding}│")
        self.stdout.write(f"└─────────────────────────────────────────────────────────────────────┘")