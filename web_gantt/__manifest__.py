# -*- coding: utf-8 -*-
{
    'name': "Web Gantt",
    'summary': """
        Gantt Chart
        """,
    'description': """Gantt Chart for Odoo""",
    'author': "Chairoj L.",
    'website': "https://bluemink.tech",
    'support': "support@bluemink.com",
    'category': 'Gantt',
    'version': '1.0.0',
    'depends': ['web', 'project'],
    'assets': {
        'web.assets_backend': [
            'web_gantt/static/src/js/gantt_view.js'
        ],
    },
    'data': [
        'data/project_data.xml',
        'views/project_project_view.xml',
    ],
    'installable': True,
    'application': False,
}
