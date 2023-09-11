# -*- coding: utf-8 -*-

from odoo import fields, models, _


class GanttMixin(models.AbstractModel):
    _name= 'gantt.mixin'
    _description = 'Gantt Mixin'
    
    # This field is many2many field contain all task that can make user for current task overloading
    bad_resource_allocation_task_ids = None
    
    bad_resource_allocation_task_alert = fields.Char(string='Bad Resource Allocation Alert', default=False,
                                                     translate=True, compute='_compute_bad_resource_allocation_task_alert')
    bad_resource_allocation_task_count = fields.Integer(string='Overlap Task Count', compute='_compute_bad_resource_allocation_task_ids')


    def _compute_bad_resource_allocation_task_alert(self):
        for r in self:
            r.bad_resource_allocation_task_alert = r._get_bad_resource_allocation_task_alert()

    def _get_bad_resource_allocation_task_alert(self):
        """
        Hooking method for others to override to customize their preferred alert messages
        """
        self.ensure_one()
        if self.bad_resource_allocation_task_count > 0:
            return _("%s other tasks for this employee are scheduled at the same time!") % self.bad_resource_allocation_task_count
        return False

    def _compute_bad_resource_allocation_task_ids(self):
        for r in self:
            r.bad_resource_allocation_task_count = 0

