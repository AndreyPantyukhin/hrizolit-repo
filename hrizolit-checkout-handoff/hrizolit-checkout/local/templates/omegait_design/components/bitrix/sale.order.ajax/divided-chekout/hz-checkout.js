/**
 * /local/templates/omegait_design/components/bitrix/sale.order.ajax/template1/hz-checkout.js
 *
 * Надстройка над BX.Sale.OrderAjaxComponent (order_ajax.js) для макета «Хризолит»: мастер из 3 шагов.
 * Подключается ПОСЛЕ order_ajax.js; order_ajax.js не правится — переопределяются методы экземпляра.
 * Завязано на внутренний API компонента: после обновления модуля sale нужен регресс-тест.
 *
 * Шаг 1 — доставка (курьер / ПВЗ / магазин) и адрес курьера
 * Шаг 2 — ваши данные (ФИО, телефон, email, комментарий)
 * Шаг 3 — оплата; «Оплатить» = штатное сохранение заказа
 *
 * Конфигурация приходит из PHP (hz-bootstrap.php) в params.HZ_CFG / params.HZ_MESS.
 */
(function () {
	'use strict';

	if (!window.BX || !BX.Sale || !BX.Sale.OrderAjaxComponent)
	{
		if (window.console && console.warn)
		{
			console.warn('hz-checkout: BX.Sale.OrderAjaxComponent не найден — hz-checkout.js подключён раньше order_ajax.js или order_ajax.js не загружен.');
		}
		return;
	}

	var C = BX.Sale.OrderAjaxComponent;
	var STEPS = 3;
	var step = 1;
	var ensureTries = 0;

	/**
	 * Шаг, порядок и ширина строк свойств по CODE.
	 * Адрес курьера (ID 79) — штатное свойство ADDRESS; STREET/BUILDING и пр. в форме не показываются.
	 */
	var ROW_STEP = {ADDRESS: 1, FIO: 2, PHONE: 2, EMAIL: 2};
	var ROW_ORDER = {LOCATION: 3, ADDRESS: 32, FIO: 50, PHONE: 51, EMAIL: 52};
	var ROW_HALF = {PHONE: 1, EMAIL: 1};
	var ROW_COURIER_ONLY = {ADDRESS: 1};
	var HIDDEN_CODES = {ZIP: 1, CITY: 1, STREET: 1, BUILDING: 1, APARTMENT: 1, ENTRANCE: 1, FLOOR: 1, INTERCOM: 1};
	var LABELS = {LOCATION: 'Город', FIO: 'ФИО', ADDRESS: 'Адрес доставки'};

	/* ------------------------------------------------------------------ утилиты */

	function cfg()
	{
		return (C.params && C.params.HZ_CFG) || {};
	}

	function mess(key, def)
	{
		var m = (C.params && C.params.HZ_MESS) || {};
		return (m[key] !== undefined && m[key] !== '') ? m[key] : def;
	}

	function idsOf(kind)
	{
		var d = cfg().delivery || {};
		return (d[kind] || []).map(String);
	}

	function kindOfDelivery(id)
	{
		var kinds = ['courier', 'pvz', 'postamat', 'pickup'], i;
		id = String(id);
		for (i = 0; i < kinds.length; i++)
		{
			if (idsOf(kinds[i]).indexOf(id) !== -1)
			{
				return kinds[i];
			}
		}
		return null;
	}

	function allowedKinds()
	{
		return cfg().scenario === 'pickup' ? ['pickup'] : ['courier', 'pvz', 'postamat'];
	}

	function deliveryItems(node)
	{
		return node ? Array.prototype.slice.call(node.querySelectorAll('.bx-soa-pp-company')) : [];
	}

	function itemDeliveryId(item)
	{
		var input = item.querySelector('input[name="DELIVERY_ID"]');
		return input ? input.value : '';
	}

	function liveRows(scope)
	{
		var rows = scope.querySelectorAll('[data-property-id-row]'), res = [], i;
		for (i = 0; i < rows.length; i++)
		{
			if (!rows[i].closest('[id$="-hidden"]')) // копии строк в служебных контейнерах движка
			{
				res.push(rows[i]);
			}
		}
		return res;
	}

	function rowByCode(scope, code)
	{
		var rows = liveRows(scope), i;
		for (i = 0; i < rows.length; i++)
		{
			if (rows[i].getAttribute('data-hz-code') === code)
			{
				return rows[i];
			}
		}
		return null;
	}

	function inputByCode(scope, code)
	{
		var row = rowByCode(scope, code);
		return row ? row.querySelector('input[type="text"]') : null;
	}

	/** Выбранная доставка → {kind, delivery} либо {kind: null}. */
	function currentKind()
	{
		var sel = C.deliveryBlockNode ? C.getSelectedDelivery() : false;
		return {kind: sel ? kindOfDelivery(sel.ID) : null, delivery: sel || null};
	}

	/* ------------------------------------------------------------------ плоский режим: все секции отрисованы */

	var origEditSection = C.editSection;
	C.editSection = function (section)
	{
		var saved;

		if (!section || !section.id || section.id === this.basketBlockNode.id)
		{
			return origEditSection.call(this, section); // корзина — штатно (в макете скрыта)
		}
		saved = this.activeSectionId;
		this.activeSectionId = section.id; // editSection считает «активной» секцию с этим id
		origEditSection.call(this, section);
		this.activeSectionId = saved;
		BX.addClass(section, 'bx-selected');
	};

	// штатная шаговая навигация, «Далее/Назад» и прилипание сайдбара не используются
	C.fade = function () {};
	C.getBlockFooter = function () {};
	C.switchOrderSaveButtons = function () {};
	C.totalBlockScrollCheck = function () {};
	C.totalBlockResizeCheck = function () {};
	C.show = function (node)
	{
		if (node && node.id)
		{
			node.setAttribute('data-visited', 'true');
			BX.addClass(node, 'bx-selected');
		}
	};

	// Свёрнутые сводки секций не нужны. Без этого locationsCompletion() после каждой перерисовки
	// заменяет раскрытое содержимое секций региона и свойств на «Ф.И.О.: E-Mail: Телефон:».
	C.editFadeRegionContent = function () {};
	C.editFadePropsContent = function () {};
	C.editFadeDeliveryContent = function () {};
	C.editFadePaySystemContent = function () {};
	C.editFadePickUpContent = function () {};

	/* ------------------------------------------------------------------ строки свойств */

	C.hzDecorateRows = function (scope)
	{
		var raw = (this.result.ORDER_PROP && this.result.ORDER_PROP.properties) || {}, byId = {}, k, rows, i, row, prop, code, label, comment,
			personType, group, hasValue;

		// выбор типа плательщика в макете не предусмотрен (значение по умолчанию остаётся в форме)
		personType = scope.querySelectorAll('[name="PERSON_TYPE"]');
		for (i = 0; i < personType.length; i++)
		{
			group = personType[i].closest('.form-group');
			group && group.classList.add('hz-hidden');
		}

		for (k in raw)
		{
			if (raw.hasOwnProperty(k))
			{
				byId[raw[k].ID] = raw[k];
			}
		}

		rows = liveRows(scope);
		for (i = 0; i < rows.length; i++)
		{
			row = rows[i];
			prop = byId[row.getAttribute('data-property-id-row')];
			code = prop && prop.CODE;
			if (!code)
			{
				continue;
			}

			row.setAttribute('data-hz-code', code);

			if (code === 'LOCATION')
			{
				row.setAttribute('data-hz-row-step', '1');
				row.style.order = ROW_ORDER.LOCATION;
				// «Самовывоз»: город уже определён (подстановка из шапки/профиль) — поле не нужно;
				// «Доставка»: поле всегда доступно, город можно выбрать любой
				hasValue = !!(prop.VALUE && prop.VALUE.length && prop.VALUE[0]);
				row.classList.toggle('hz-hidden', cfg().scenario === 'pickup' && hasValue);
				label = row.querySelector('label.bx-soa-custom-label, label.bx-soa-customer-label, label');
				label && LABELS.LOCATION && (label.firstChild && label.firstChild.nodeType === 3
					? (label.firstChild.nodeValue = LABELS.LOCATION) : null);
				continue;
			}
			if (HIDDEN_CODES[code])
			{
				row.classList.add('hz-hidden');
				continue;
			}

			row.setAttribute('data-hz-row-step', String(ROW_STEP[code] || 2));
			row.style.order = ROW_ORDER[code] || 55;
			row.classList.toggle('hz-half', !!ROW_HALF[code]);

			if (LABELS[code])
			{
				label = row.querySelector('label.bx-soa-custom-label');
				label && (label.textContent = LABELS[code]);
			}
		}

		// комментарий к заказу (штатно без data-property-id-row)
		comment = scope.querySelector('#orderDescription');
		if (comment)
		{
			row = comment.closest('.col-sm-12') || comment.closest('.form-group'); // flex-элемент — обёртка col-sm-12
			if (row)
			{
				row.setAttribute('data-hz-row-step', '2');
				row.style.order = 60;
				label = row.querySelector('label');
				label && (label.textContent = mess('COMMENT_LABEL', 'Комментарий (необязательно)'));
				comment.setAttribute('placeholder', mess('COMMENT_PH', 'Оставьте комментарий к заказу'));
			}
		}
	};

	/* ------------------------------------------------------------------ доставка */

	C.hzDecorateDelivery = function ()
	{
		var node = this.deliveryBlockNode, items, allowed = allowedKinds(), selectedKind = currentKind().kind;

		if (!node)
		{
			return;
		}
		items = deliveryItems(node);

		items.forEach(function (it) {
			var kind = kindOfDelivery(itemDeliveryId(it)), title = it.querySelector('.bx-soa-pp-company-smalltitle');

			it.classList.remove('hz-hidden', 'hz-selected');

			// карточка описания выбранной доставки: в ней живёт интерфейс модуля СДЭК (выбор пункта/адреса)
			if (it.closest('.bx-soa-pp-desc-container'))
			{
				(selectedKind === null || selectedKind === 'pickup') && it.classList.add('hz-hidden');
				return;
			}
			if (!kind || allowed.indexOf(kind) === -1)
			{
				it.classList.add('hz-hidden'); // чужой сценарий и неизвестная служба доставки
				return;
			}
			BX.hasClass(it, 'bx-selected') && it.classList.add('hz-selected');
			title && (title.textContent = mess('DELIVERY_' + kind.toUpperCase(), title.textContent));
		});

		node.classList.toggle('hz-single', cfg().scenario === 'pickup');

		// порядок как в макете: курьер, ПВЗ, постамат (штатный — по ID/сортировке служб доставки)
		(function () {
			var order = {courier: 1, pvz: 2, postamat: 3, pickup: 4}, desc = node.querySelector('.bx-soa-pp-desc-container'), first = null;

			items.forEach(function (it) {
				var kind = kindOfDelivery(itemDeliveryId(it));
				if (kind && !it.closest('.bx-soa-pp-desc-container'))
				{
					it.style.order = order[kind];
					first = first || it;
				}
			});
			if (first && first.parentNode)
			{
				first.parentNode.classList.add('hz-col');
				desc && desc.parentNode === first.parentNode && (desc.style.order = 10);
			}
		})();
	};

	/**
	 * Платёжные системы: названия, порядок и состав — из админки (штатный вывод движка).
	 * Здесь только: скрываем карточку описания выбранной оплаты и помечаем выбранную систему.
	 */
	C.hzDecoratePaySystem = function ()
	{
		var node = this.paySystemBlockNode;

		if (!node)
		{
			return;
		}
		Array.prototype.slice.call(node.querySelectorAll('.bx-soa-pp-company')).forEach(function (it) {
			if (!it.querySelector('input[name="PAY_SYSTEM_ID"]'))
			{
				it.classList.add('hz-hidden'); // карточка описания выбранной оплаты в макете не нужна
				return;
			}
			it.classList.toggle('hz-selected', BX.hasClass(it, 'bx-selected'));
		});
	};

	/** Если сервер выбрал доставку не из сценария — переключаем на первую разрешённую. */
	C.hzEnsureDelivery = function ()
	{
		var cur, items, i;

		if (!this.deliveryBlockNode)
		{
			return;
		}
		cur = currentKind();
		if (cur.kind && allowedKinds().indexOf(cur.kind) !== -1)
		{
			ensureTries = 0;
			return;
		}
		if (ensureTries >= 2)
		{
			return; // защита от цикла
		}
		ensureTries++;

		items = deliveryItems(this.deliveryBlockNode);
		for (i = 0; i < items.length; i++)
		{
			if (itemDeliveryId(items[i]) && !BX.hasClass(items[i], 'hz-hidden'))
			{
				items[i].click(); // штатный selectDelivery → sendRequest
				return;
			}
		}
	};

	// Выбор магазина самовывоза не делает refresh заказа — обновляем сводку, шапку шага и кнопку вручную.
	var origSelectStore = C.selectStore;
	C.selectStore = function ()
	{
		var res = origSelectStore.apply(this, arguments);
		this.hzRenderSummary();
		this.hzRenderStepHead();
		this.hzRenderBar();
		return res;
	};

	/* ------------------------------------------------------------------ шаги */

	/** Строка для шапки шага и сайдбара: {title, sub}. */
	C.hzDeliverySummary = function ()
	{
		var cur = currentKind(), store;

		if (!cur.kind)
		{
			return {title: '', sub: ''};
		}
		if (cur.kind === 'pickup')
		{
			store = this.getSelectedPickUp ? this.getSelectedPickUp() : null;
			return {
				title: mess('DELIVERY_PICKUP', 'Самовывоз'),
				sub: store ? [store.TITLE, store.ADDRESS].filter(Boolean).join(' · ') : '',
				storeTitle: store ? store.TITLE : '',
				storeAddress: store ? store.ADDRESS : ''
			};
		}
		return {title: mess('DELIVERY_' + cur.kind.toUpperCase(), ''), sub: ''};
	};

	C.hzApplyStep = function ()
	{
		var scope = this.orderBlockNode, form = document.getElementById('bx-soa-order-form'), kind = currentKind().kind,
			rows, i, code, show, nodes, list, scenario = cfg().scenario;

		if (!scope || !form)
		{
			return;
		}
		form.setAttribute('data-hz-step', String(step));

		this.regionBlockNode && (this.regionBlockNode.hidden = step !== 1);
		this.deliveryBlockNode && (this.deliveryBlockNode.hidden = step !== 1);
		this.pickUpBlockNode && (this.pickUpBlockNode.hidden = step !== 1);
		this.paySystemBlockNode && (this.paySystemBlockNode.hidden = step !== 3);

		rows = scope.querySelectorAll('[data-hz-row-step]');
		for (i = 0; i < rows.length; i++)
		{
			code = rows[i].getAttribute('data-hz-code');
			show = Number(rows[i].getAttribute('data-hz-row-step')) === step;
			if (show && code && ROW_COURIER_ONLY[code] && kind !== 'courier')
			{
				show = false;
			}
			rows[i].hidden = !show;
		}

		// статические элементы каркаса: data-hz-for="2,3", data-hz-scenario="pickup"
		nodes = form.querySelectorAll('[data-hz-for]');
		for (i = 0; i < nodes.length; i++)
		{
			list = nodes[i].getAttribute('data-hz-for').split(',');
			show = list.indexOf(String(step)) !== -1;
			if (show && nodes[i].hasAttribute('data-hz-scenario'))
			{
				show = nodes[i].getAttribute('data-hz-scenario') === scenario;
			}
			if (show && nodes[i].hasAttribute('data-hz-kind'))
			{
				show = nodes[i].getAttribute('data-hz-kind').split(',').indexOf(String(kind)) !== -1;
			}
			nodes[i].hidden = !show;
		}

		this.hzRenderBar();
		this.hzRenderStepHead();
	};

	C.hzRenderStepHead = function ()
	{
		var node = document.querySelector('[data-hz-stephead]'), sum = this.hzDeliverySummary(), t, s;

		if (!node)
		{
			return;
		}
		t = node.querySelector('[data-hz-stephead-title]');
		s = node.querySelector('[data-hz-stephead-sub]');
		t && (t.textContent = sum.title);
		if (s)
		{
			s.textContent = sum.sub;
			s.hidden = !sum.sub;
		}
	};

	C.hzRenderBar = function ()
	{
		var items = document.querySelectorAll('[data-hz-step-item]'), i, n, next = document.querySelector('[data-hz-next]'),
			save = document.querySelector('#bx-soa-orderSave [data-save-button]'), counter = document.querySelector('[data-hz-counter]'),
			labels = {1: 'NEXT_1', 2: 'NEXT_2'}, defs = {1: 'Ваши данные', 2: 'Перейти к оплате'};

		for (i = 0; i < items.length; i++)
		{
			n = Number(items[i].getAttribute('data-hz-step-item'));
			items[i].classList.toggle('is-current', n === step);
			items[i].classList.toggle('is-done', n < step);
		}
		counter && (counter.textContent = step + ' ' + mess('OF', 'из') + ' ' + STEPS);

		if (next)
		{
			next.hidden = step === STEPS;
			next.textContent = mess(labels[step] || 'NEXT_2', defs[step] || defs[2]);
			next.classList.toggle('hz-btn--disabled', !this.hzStepReady(step));
		}
		save && (save.hidden = step !== STEPS);
	};

	/** Можно ли нажимать «Далее» (визуально). Этап 3: ПВЗ СДЭК. */
	C.hzStepReady = function (n)
	{
		var cur, store;

		if (n === 1)
		{
			cur = currentKind();
			if (!cur.kind)
			{
				return false;
			}
			if (cur.kind === 'pickup')
			{
				store = BX('BUYER_STORE');
				return !!(store && parseInt(store.value, 10) > 0);
			}
		}
		return true;
	};

	/** Валидация строк свойств через штатный isValidProperty (ошибки показывает сам движок). */
	C.hzValidateRows = function (rows)
	{
		var errors = [], i, id, container, prop, data;

		for (i = 0; i < rows.length; i++)
		{
			if (rows[i].hidden || rows[i].classList.contains('hz-hidden'))
			{
				continue;
			}
			id = rows[i].getAttribute('data-property-id-row');
			container = rows[i].querySelector('.soa-property-container') || rows[i];
			prop = this.validation && this.validation.properties && this.validation.properties[id];
			if (!prop)
			{
				continue;
			}
			data = this.getValidationData(prop, container);
			errors = errors.concat(this.isValidProperty(data, true));
		}
		return errors;
	};

	C.hzValidateStep = function (n)
	{
		var scope = this.orderBlockNode, rows, consent, errors = 0;

		if (n === 1)
		{
			if (!this.hzStepReady(1))
			{
				return false;
			}
			errors += this.isValidRegionBlock().length;
			rows = scope.querySelectorAll('[data-hz-row-step="1"][data-property-id-row]:not([data-hz-code="LOCATION"])');
			errors += this.hzValidateRows(rows).length;
			return errors === 0;
		}
		if (n === 2)
		{
			rows = scope.querySelectorAll('[data-hz-row-step="2"][data-property-id-row]');
			errors += this.hzValidateRows(rows).length;

			consent = document.querySelector('#bx-soa-orderSave label[data-bx-user-consent] input[type="checkbox"]');
			if (consent && !consent.checked)
			{
				BX.addClass(consent.closest('label'), 'hz-error');
				errors++;
			}
			return errors === 0;
		}
		return true;
	};

	C.hzGo = function (n)
	{
		n = Math.max(1, Math.min(STEPS, n));
		if (n === step)
		{
			return;
		}
		step = n;
		this.hzApplyStep();
		try { window.history.pushState({hzStep: n}, '', '#step-' + n); } catch (e) {}
		this.orderBlockNode && this.animateScrollTo && this.animateScrollTo(this.orderBlockNode, 300, 80);
	};

	C.hzNext = function ()
	{
		if (step < STEPS && this.hzValidateStep(step))
		{
			this.hzGo(step + 1);
		}
	};

	document.addEventListener('click', function (e) {
		var t = e.target && e.target.closest ? e.target.closest('[data-hz-next],[data-hz-goto]') : null, goto;

		if (!t || !C.orderBlockNode)
		{
			return;
		}
		e.preventDefault();

		if (t.hasAttribute('data-hz-next'))
		{
			!t.classList.contains('hz-btn--disabled') && C.hzNext();
			return;
		}
		goto = t.getAttribute('data-hz-goto');
		C.hzGo(goto === 'prev' ? step - 1 : parseInt(goto, 10) || 1);
	});

	window.addEventListener('popstate', function (e) {
		var n = e.state && e.state.hzStep ? e.state.hzStep : 1;
		if (C.orderBlockNode && n !== step)
		{
			step = Math.max(1, Math.min(STEPS, n));
			C.hzApplyStep();
		}
	});

	document.addEventListener('change', function (e) {
		var t = e.target;
		if (t && t.matches && t.matches('label[data-bx-user-consent] input[type="checkbox"]'))
		{
			BX.removeClass(t.closest('label'), 'hz-error');
		}
	});

	/* ------------------------------------------------------------------ сводка и купон */

	C.hzRenderSummary = function ()
	{
		var node = this.totalInfoBlockNode, total = this.result && this.result.TOTAL, rows, qty = 0, k, sum, cur, deliveryText, couponHtml,
			list, coupons = [], i, couponBox, notes, pending = false;

		if (!node || !total)
		{
			return;
		}

		rows = (this.result.GRID && this.result.GRID.ROWS) || {};
		for (k in rows)
		{
			if (rows.hasOwnProperty(k) && rows[k].data)
			{
				qty += parseFloat(rows[k].data.QUANTITY) || 0;
			}
		}

		sum = this.hzDeliverySummary();
		cur = currentKind();
		deliveryText = sum.title || mess('SUM_DELIVERY_NONE', 'Не выбрана');

		list = this.result.COUPON_LIST || [];
		for (i = 0; i < list.length; i++)
		{
			if (list[i].JS_STATUS === 'APPLIED')
			{
				coupons.push(BX.util.htmlspecialchars(list[i].COUPON));
			}
		}
		couponHtml = coupons.length ? coupons.join(', ') : mess('SUM_COUPON_NONE', 'Не применён');

		BX.cleanNode(node);
		node.appendChild(BX.create('H3', {props: {className: 'hz-sum__title'}, text: mess('SUM_TITLE', 'Сводка заказа')}));

		[
			[mess('SUM_QTY', 'Количество'), qty + ' ' + mess('SUM_QTY_UNIT', 'шт.'), true, false],
			[mess('SUM_TOTAL', 'Итого'), total.ORDER_TOTAL_PRICE_FORMATED || total.ORDER_PRICE_FORMATED, true, true],
			[mess('SUM_DELIVERY', 'Доставка'), BX.util.htmlspecialchars(deliveryText), false, false],
			[mess('SUM_COUPON', 'Промокод'), couponHtml, !coupons.length ? false : true, false]
		].forEach(function (r, idx) {
			node.appendChild(BX.create('DIV', {
				props: {className: 'hz-sum__row'},
				children: [
					BX.create('SPAN', {text: r[0]}),
					BX.create('SPAN', {props: {className: 'hz-sum__value' + (r[2] ? ' is-strong' : '') + ((idx === 3 && !coupons.length) || (idx === 2 && !sum.title) ? ' is-muted' : '')}, html: r[1]})
				]
			}));
		});

		// адрес магазина самовывоза / подсказка про ПВЗ
		if (cur.kind === 'pickup' && sum.storeTitle)
		{
			node.appendChild(BX.create('DIV', {
				props: {className: 'hz-sum__store'},
				children: [
					BX.create('DIV', {text: sum.storeTitle}),
					BX.create('DIV', {props: {className: 'hz-sum__store-addr'}, text: sum.storeAddress})
				]
			}));
		}
		else if (cur.kind === 'pvz' || cur.kind === 'postamat')
		{
			pending = !cfg().pvzChosen; // этап 3: признак выбранного пункта СДЭК
			pending && node.appendChild(BX.create('DIV', {props: {className: 'hz-sum__hint'}, text: mess('SUM_PVZ_NONE', 'Пункт выдачи не выбран')}));
		}

		// промокод вводится здесь (штатный блок купона, как в корзине штатного шаблона)
		if (this.params.SHOW_COUPONS === 'Y')
		{
			couponBox = BX.create('DIV', {props: {className: 'hz-sum__coupon'}});
			this.editCoupons(couponBox);
			node.appendChild(couponBox);
		}

		// информационный блок про бесплатную доставку — только для курьера
		if (cur.kind === 'courier' && mess('SUM_NOTE_TITLE', ''))
		{
			notes = BX.create('DIV', {
				props: {className: 'hz-sum__note'},
				children: [
					BX.create('DIV', {props: {className: 'hz-sum__note-title'}, text: mess('SUM_NOTE_TITLE', '')}),
					BX.create('DIV', {props: {className: 'hz-sum__note-text'}, text: mess('SUM_NOTE_TEXT', '')})
				]
			});
			node.appendChild(notes);
		}
	};

	var origEditTotalBlock = C.editTotalBlock;
	C.editTotalBlock = function ()
	{
		origEditTotalBlock.apply(this, arguments);
		this.hzRenderSummary();
	};

	/* ------------------------------------------------------------------ точка входа: после каждой перерисовки */

	var origEditOrder = C.editOrder;
	C.editOrder = function ()
	{
		origEditOrder.apply(this, arguments);

		if (!this.orderBlockNode)
		{
			return;
		}
		if (this.params.USER_CONSENT === 'Y' && !this.orderBlockNode.querySelector('[data-bx-user-consent]') && window.console && console.warn)
		{
			console.warn('hz-checkout: блок согласия на ПД находится вне #bx-soa-order — «Оплатить» работать не будет. Подключите hz-bar.php внутри #bx-soa-order.');
		}
		this.hzDecorateRows(this.orderBlockNode);
		this.hzDecorateDelivery();
		this.hzDecoratePaySystem();
		this.hzEnsureDelivery();
		this.hzApplyStep();
		this.hzRenderSummary(); // после hzApplyStep: сводка зависит от выбранной доставки
		document.documentElement.classList.add('hz-checkout-page');
	};

	// высота фиксированной панели → отступ страницы, чтобы панель не закрывала контент
	(function watchBar() {
		function sync()
		{
			var bar = document.querySelector('.hz-bar');
			bar && document.documentElement.style.setProperty('--hz-bar-h', bar.offsetHeight + 'px');
		}
		window.addEventListener('resize', sync);
		window.addEventListener('load', sync);
		document.addEventListener('DOMContentLoaded', sync);
	})();
})();
