/**
 * /local/templates/omegait_design/hz/basket/hz-basket-delivery.js
 *
 * Корзина (локальная копия шаблона bitrix:sale.basket.basket): окно «Выберите способ получения».
 * Ведёт на страницу заказа с параметром hz_delivery=delivery|pickup.
 *
 * Подключение: в js/component.js копии шаблона checkOutAction вызывает HzBasketDelivery.open(PATH_TO_ORDER)
 * (если скрипт не загрузился — штатный переход). Резервный режим без правки component.js:
 * window.HZ_BASKET_DELIVERY = {autoBind: true} — перехват клика по [data-entity="basket-checkout-button"].
 */
(function () {
	'use strict';

	var BUTTON_SELECTOR = '[data-entity="basket-checkout-button"]';
	var PARAM = 'hz_delivery';
	var TYPES = {delivery: 'delivery', pickup: 'pickup'}; // белый список значений

	var cfg = window.HZ_BASKET_DELIVERY || {};
	var mess = {
		title: cfg.title || 'Выберите способ получения',
		delivery: cfg.delivery || 'Доставка',
		pickup: cfg.pickup || 'Самовывоз',
		close: cfg.close || 'Закрыть'
	};

	var root = null;
	var lastFocus = null;
	var orderUrlOverride = '';

	function getOrderUrl()
	{
		var path = orderUrlOverride || cfg.orderUrl || '/personal/order/make/';

		if (!orderUrlOverride && window.BX && BX.Sale && BX.Sale.BasketComponent && BX.Sale.BasketComponent.params
			&& BX.Sale.BasketComponent.params.PATH_TO_ORDER)
		{
			path = BX.Sale.BasketComponent.params.PATH_TO_ORDER;
		}
		return path;
	}

	/** Адрес страницы заказа с параметром сценария; только свой домен. */
	function buildUrl(type)
	{
		var target = getOrderUrl(), url;

		if (!TYPES[type])
		{
			return '';
		}
		try
		{
			url = new URL(target, window.location.origin);
			if (url.origin !== window.location.origin)
			{
				url = new URL('/personal/order/make/', window.location.origin);
			}
			url.searchParams.set(PARAM, type);
			return url.pathname + url.search + url.hash;
		}
		catch (e)
		{
			return target;
		}
	}

	function go(type)
	{
		var href = buildUrl(type);
		href && (window.location.href = href);
	}

	function el(tag, className, text)
	{
		var node = document.createElement(tag);
		if (className) { node.className = className; }
		if (text) { node.textContent = text; }
		return node;
	}

	function close()
	{
		if (!root) { return; }
		document.removeEventListener('keydown', onKeydown, true);
		document.documentElement.classList.remove('hz-modal-open');
		root.parentNode && root.parentNode.removeChild(root);
		root = null;
		lastFocus && lastFocus.focus && lastFocus.focus();
	}

	function onKeydown(e)
	{
		var focusable, first, last;

		if (e.key === 'Escape')
		{
			e.preventDefault();
			close();
			return;
		}
		if (e.key === 'Tab' && root)
		{
			focusable = root.querySelectorAll('button');
			first = focusable[0];
			last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first)
			{
				e.preventDefault();
				last.focus();
			}
			else if (!e.shiftKey && document.activeElement === last)
			{
				e.preventDefault();
				first.focus();
			}
		}
	}

	function open()
	{
		var overlay, dialog, head, title, closeBtn, actions, btnDelivery, btnPickup;

		if (root) { return; }
		lastFocus = document.activeElement;

		overlay = el('div', 'hz-modal');
		dialog = el('div', 'hz-modal__dialog');
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.setAttribute('aria-labelledby', 'hz-modal-title');

		head = el('div', 'hz-modal__head');
		title = el('h2', 'hz-modal__title', mess.title);
		title.id = 'hz-modal-title';
		closeBtn = el('button', 'hz-modal__close');
		closeBtn.type = 'button';
		closeBtn.setAttribute('aria-label', mess.close);
		closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" fill="none" stroke-width="1.2"/></svg>';

		actions = el('div', 'hz-modal__actions');
		btnDelivery = el('button', 'hz-modal__btn', mess.delivery);
		btnDelivery.type = 'button';
		btnPickup = el('button', 'hz-modal__btn', mess.pickup);
		btnPickup.type = 'button';

		head.appendChild(title);
		head.appendChild(closeBtn);
		actions.appendChild(btnDelivery);
		actions.appendChild(btnPickup);
		dialog.appendChild(head);
		dialog.appendChild(actions);
		overlay.appendChild(dialog);

		closeBtn.addEventListener('click', close);
		btnDelivery.addEventListener('click', function () { go(TYPES.delivery); });
		btnPickup.addEventListener('click', function () { go(TYPES.pickup); });
		overlay.addEventListener('mousedown', function (e) {
			if (e.target === overlay) { close(); }
		});

		document.body.appendChild(overlay);
		document.documentElement.classList.add('hz-modal-open');
		document.addEventListener('keydown', onKeydown, true);
		root = overlay;
		btnDelivery.focus();
	}

	if (cfg.autoBind === true)
	{
		document.addEventListener('click', onCheckoutClick, true);
	}

	function onCheckoutClick(e)
	{
		var btn = e.target && e.target.closest ? e.target.closest(BUTTON_SELECTOR) : null;

		if (!btn)
		{
			return;
		}
		// Кнопка заблокирована компонентом (DISABLE_CHECKOUT) — штатное поведение
		if (btn.classList.contains('disabled') || btn.disabled)
		{
			return;
		}

		e.preventDefault();
		e.stopImmediatePropagation(); // штатный обработчик (переход на PATH_TO_ORDER) не нужен
		open();
	}

	window.HzBasketDelivery = {
		open: function (orderUrl) {
			typeof orderUrl === 'string' && orderUrl !== '' && (orderUrlOverride = orderUrl);
			open();
		},
		close: close,
		buildUrl: buildUrl
	};
})();
