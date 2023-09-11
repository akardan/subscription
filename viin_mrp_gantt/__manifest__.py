# -*- coding: utf-8 -*-
{
    'name': "Manufacturing Gantt",
    'summary': """Use Gantt charts to plan, allocate resources, and determine the time to do, and efficiency for manufacturing orders.""",
    'summary_vi_VN': """Sử dụng biểu đồ gantt để lập kế hoạch, phân bổ nguồn lực, xác định thời gian thực hiện và hiệu suất cho các lệnh sản xuất""",
    'description': """Integrate manufacturing with gantt view""",

    'author': "Viindoo",
    'website': "https://viindoo.com/intro/mrp",
    'live_test_url': "https://v15demo-int.viindoo.com",
    'live_test_url_vi_VN': "https://v15demo-vn.viindoo.com",
    'support': "apps.support@viindoo.com",

    'category': 'Manufacturing',
    'version': '0.1',
    'depends': ['mrp', 'viin_web_gantt'],
    'data': [
        'views/mrp_production_view.xml',
        'views/mrp_workorder_view.xml',
        'data/mrp_data.xml',
    ],
    'images' : ['static/description/main_screenshot.png'],
    'uninstall_hook': 'uninstall_hook',
    'installable': True,
    'application': False,
    'auto_install': ['mrp'],
    'price': 45.9,
    'currency': 'EUR',
    'license': 'OPL-1',
}
