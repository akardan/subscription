import logging
import os

from lxml import etree

from odoo.loglevels import ustr
from odoo.tools import misc, view_validation

_logger = logging.getLogger(__name__)

_viin_gantt_validator = None


@view_validation.validate('viin_gantt')
def schema_viin_gantt(arch, **kwargs):
    """ Check the viin_gantt view against its schema

    :type arch: etree._Element
    """
    global _viin_gantt_validator

    if _viin_gantt_validator is None:
        with misc.file_open(os.path.join('viin_web_gantt', 'views', 'viin_web_gantt.rng')) as f:
            _viin_gantt_validator = etree.RelaxNG(etree.parse(f))

    if _viin_gantt_validator.validate(arch):
        return True

    for error in _viin_gantt_validator.error_log:
        _logger.error(ustr(error))
    return False
