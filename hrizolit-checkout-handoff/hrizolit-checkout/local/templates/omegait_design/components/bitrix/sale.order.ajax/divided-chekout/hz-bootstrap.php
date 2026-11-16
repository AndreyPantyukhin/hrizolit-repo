<?php
/**
 * /local/templates/omegait_design/components/bitrix/sale.order.ajax/template1/hz-bootstrap.php
 *
 * Подключается из template.php (include __DIR__.'/hz-bootstrap.php') ПОСЛЕ нормализации $arParams
 * и ДО подписи параметров. Готовит конфигурацию мастера и тексты для hz-checkout.js.
 *
 * Конфигурация: ключ hz_checkout в /bitrix/.settings.php (необязательный; ниже — значения проекта «Хризолит»):
 *   'hz_checkout' => ['value' => [
 *       'delivery' => ['courier' => [79], 'pvz' => [80], 'postamat' => [81], 'pickup' => [3]],
 *       'free_delivery_from' => 15000,
 *   ], 'readonly' => false],
 *
 * @var array $arParams
 * @var \Bitrix\Main\HttpRequest $request
 */

if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true)
{
	die();
}

use Bitrix\Main\Config\Configuration;
use Bitrix\Main\Localization\Loc;

Loc::loadMessages(__DIR__.'/template.php');

/** Текст из lang/ru/template.php (ключи HZ_*) либо значение по умолчанию. */
$hzMsg = static function (string $code, string $default): string
{
	$text = Loc::getMessage($code);

	return (is_string($text) && $text !== '') ? $text : $default;
};

$hzIds = static function ($value): array
{
	return array_values(array_filter(array_map('intval', (array)$value)));
};

$hzCfgRaw = Configuration::getValue('hz_checkout');
$hzCfgRaw = is_array($hzCfgRaw) ? $hzCfgRaw : [];
$hzDeliveryRaw = (array)($hzCfgRaw['delivery'] ?? []);

// Сценарий приходит из корзины (?hz_delivery=delivery|pickup); принимаем только значения из белого списка.
$hzScenario = (string)$request->get('hz_delivery');

$hzCfg = [
	'scenario' => in_array($hzScenario, ['delivery', 'pickup'], true) ? $hzScenario : 'delivery',
	'delivery' => [
		'courier' => $hzIds($hzDeliveryRaw['courier'] ?? [79]),
		'pvz' => $hzIds($hzDeliveryRaw['pvz'] ?? [80]),
		'postamat' => $hzIds($hzDeliveryRaw['postamat'] ?? [81]),
		'pickup' => $hzIds($hzDeliveryRaw['pickup'] ?? [3]),
	],
	'freeFrom' => (int)($hzCfgRaw['free_delivery_from'] ?? 15000),
];

// Город из куки шапки — только для вывода в заголовке; значение сверяется со списком города шапки.
$hzKnownCities = ['Новосибирск', 'Новосибирская область', 'Новый Уренгой', 'Салехард', 'Мирный', 'Удачный'];
$hzCity = (string)$request->getCookieRaw('selected_city');
$hzCity = in_array($hzCity, $hzKnownCities, true) ? $hzCity : $hzKnownCities[0];

$hzFree = number_format($hzCfg['freeFrom'], 0, '', "\xC2\xA0").' ₽';

$arParams['HZ_CFG'] = $hzCfg;
$arParams['HZ_MESS'] = [
	'DELIVERY_COURIER' => $hzMsg('HZ_DELIVERY_COURIER', 'Курьером'),
	'DELIVERY_PVZ' => $hzMsg('HZ_DELIVERY_PVZ', 'В пункт выдачи (ПВЗ)'),
	'DELIVERY_POSTAMAT' => $hzMsg('HZ_DELIVERY_POSTAMAT', 'В постамат'),
	'DELIVERY_PICKUP' => $hzMsg('HZ_DELIVERY_PICKUP', 'Самовывоз'),
	'COMMENT_LABEL' => $hzMsg('HZ_COMMENT_LABEL', 'Комментарий (необязательно)'),
	'COMMENT_PH' => $hzMsg('HZ_COMMENT_PH', 'Оставьте комментарий к заказу'),
	'NEXT_1' => $hzMsg('HZ_NEXT_1', 'Ваши данные'),
	'NEXT_2' => $hzMsg('HZ_NEXT_2', 'Перейти к оплате'),
	'OF' => $hzMsg('HZ_OF', 'из'),
	'SUM_TITLE' => $hzMsg('HZ_SUM_TITLE', 'Сводка заказа'),
	'SUM_QTY' => $hzMsg('HZ_SUM_QTY', 'Количество'),
	'SUM_QTY_UNIT' => $hzMsg('HZ_SUM_QTY_UNIT', 'шт.'),
	'SUM_TOTAL' => $hzMsg('HZ_SUM_TOTAL', 'Итого'),
	'SUM_DELIVERY' => $hzMsg('HZ_SUM_DELIVERY', 'Доставка'),
	'SUM_DELIVERY_NONE' => $hzMsg('HZ_SUM_DELIVERY_NONE', 'Не выбрана'),
	'SUM_COUPON' => $hzMsg('HZ_SUM_COUPON', 'Промокод'),
	'SUM_COUPON_NONE' => $hzMsg('HZ_SUM_COUPON_NONE', 'Не применён'),
	'SUM_PVZ_NONE' => $hzMsg('HZ_SUM_PVZ_NONE', 'Пункт выдачи не выбран'),
	'SUM_NOTE_TITLE' => $hzMsg('HZ_SUM_NOTE_TITLE', 'Бесплатная доставка'),
	'SUM_NOTE_TEXT' => str_replace('#SUM#', $hzFree, $hzMsg('HZ_SUM_NOTE_TEXT', 'При заказе от #SUM# доставка курьером бесплатна.')),
];

// Принудительные параметры под макет: купон вводится в сайдбаре, карты и «ближайшие пункты» не нужны.
$arParams['SHOW_COUPONS_BASKET'] = 'N';
$arParams['SHOW_COUPONS_DELIVERY'] = 'N';
$arParams['SHOW_COUPONS_PAY_SYSTEM'] = 'N';
$arParams['SHOW_TOTAL_ORDER_BUTTON'] = 'N';
$arParams['SHOW_PICKUP_MAP'] = 'N';
$arParams['SHOW_NEAREST_PICKUP'] = 'N';
$arParams['SHOW_MAP_IN_PROPS'] = 'N';
