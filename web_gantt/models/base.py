from lxml.builder import E

from odoo import api, models


class Base(models.AbstractModel):
    _inherit = 'base'
    
    @api.model
    def _get_default_webgantt_view(self):
        return E.webgantt(string=self._description)
    
    @api.model
    def write_from_gantt(self, vals_list):
        ids = [vals['id'] for vals in vals_list if 'id' in vals]
        records = self.env[self._name].browse(ids).exists()
        changed_records = self.env[self._name]
        for record in records:
            for vals in filter(lambda v: v.get('id') == record.id, vals_list):
                vals.pop('id')
                # update record if there is an item in vals
                if bool(vals):
                    record.write(vals)
                    changed_records += record
        # clear cached to ensure we have fresh data here
        changed_records.invalidate_cache()
        if changed_records:
            return changed_records.read()
        else:
            return []
