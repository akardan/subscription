from lxml.builder import E

from odoo import api, models


class Base(models.AbstractModel):
    _inherit = 'base'
    
    @api.model
    def _get_default_viin_gantt_view(self):
        """ Generates an empty viin_gantt view.

        :returns: a viin_gantt view as an lxml document
        :rtype: etree._Element
        """
        return E.viin_gantt(string=self._description)
    
    @api.model
    def write_from_gantt(self, vals_list):
        """This is called from gantt client"""
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
