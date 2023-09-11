function translateDateText(string, lang, info) {
	var translatedText = {
		'vi_VN': {
			'January': 'Tháng 1',
			'February': 'Tháng 2',
			'March': 'Tháng 3',
			'April': 'Tháng 4',
			'May': 'Tháng 5',
			'June': 'Tháng 6',
			'July': 'Tháng 7',
			'August': 'Tháng 8',
			'September': 'Tháng 9',
			'October': 'Tháng 10',
			'November': 'Tháng 11',
			'December': 'Tháng 12',
			'S': 'CN',
			'M': 'T2',
			'T': 'T3',
			'W': 'T4',
			'T1': 'T5',
			'F': 'T6',
			'S1': 'T7',
			'Jan': 'Thg 1',
			'Feb': 'Thg 2',
			'Mar': 'Thg 3',
			'Apr': 'Thg 4',
			'May': 'Thg 5',
			'Jun': 'Thg 6',
			'Jul': 'Thg 7',
			'Aug': 'Thg 8',
			'Sep': 'Thg 9',
			'Oct': 'Thg 10',
			'Nov': 'Thg 11',
			'Dec': 'Thg 12',
			'Sun': 'CN',
			'Mon': 'T2',
			'Tue': 'T3',
			'Wed': 'T4',
			'Thu': 'T5',
			'Fri': 'T6',
			'Sat': 'T7',
		}
	}
	var langDictText = translatedText[lang];
	if(!langDictText) {
		return string;
	}
	var splitedText = string.split(' ');
	for(var i = 0; i < splitedText.length; i++) {
		var w = splitedText[i];
		if(langDictText[w]) {
			splitedText[i] = langDictText[w];
		}
	}
	return splitedText.join(' ');
}