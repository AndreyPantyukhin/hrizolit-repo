<?php
/**
 * /local/php_interface/include/hz_checkout.php
 *
 * Подстановка местоположения (LOCATION) в оформлении заказа по городу из шапки сайта (кука selected_city).
 * Только значение по умолчанию: покупатель может выбрать любой другой город, сохранённое в профиле
 * местоположение не перезаписывается, подстановка выполняется только при первой загрузке страницы (GET).
 *
 * Подключение: в /local/php_interface/init.php добавить строку
 *     require_once __DIR__.'/include/hz_checkout.php';
 *
 * Соответствие «город из шапки → код местоположения» — в /bitrix/.settings.php (необязательно):
 *     'hz_checkout' => ['value' => ['cities' => ['Новосибирск' => '0000949228', 'Новосибирская область' => null]], 'readonly' => false],
 * null (или пустое значение) — подставлять нельзя (например, регион). Значения по умолчанию — ниже.
 */

use Bitrix\Main\Config\Configuration;
use Bitrix\Main\EventManager;
use Bitrix\Main\Loader;

if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true)
{
	die();
}

final class HzCheckoutLocation
{
	/** Значения проекта «Хризолит» (получены из справочника местоположений). */
	private const DEFAULT_CITIES = [
		'Новосибирск' => '0000949228',
		'Новосибирская область' => null, // регион: доставка по нему не считается, покупатель выбирает населённый пункт
		'Новый Уренгой' => '0000108785',
		'Салехард' => '0000108152',
		'Мирный' => '0001054105', // Республика Саха (Якутия). ПРОВЕРИТЬ: есть ещё Мирный Архангельской области (0000110395)
		'Удачный' => '0001054212',
	];

	/**
	 * Обработчик sale:OnSaleComponentOrderProperties (sale.order.ajax).
	 *
	 * @param array $arUserResult
	 * @param \Bitrix\Main\HttpRequest $request
	 */
	public static function onOrderProperties(&$arUserResult, $request, &$arParams = null, &$arResult = null): void
	{
		if (!is_array($arUserResult) || !is_object($request) || $request->isPost())
		{
			return; // только первая загрузка страницы; refresh и сохранение заказа — POST
		}

		$city = (string)$request->getCookieRaw('selected_city');
		$cities = self::cities();
		$code = $cities[$city] ?? null;
		if (!is_string($code) || $code === '' || !Loader::includeModule('sale'))
		{
			return;
		}

		$personTypeId = (int)($arUserResult['PERSON_TYPE_ID'] ?? 0);
		if ($personTypeId <= 0)
		{
			return;
		}

		$property = \Bitrix\Sale\Internals\OrderPropsTable::getList([
			'select' => ['ID'],
			'filter' => [
				'=PERSON_TYPE_ID' => $personTypeId,
				'=ACTIVE' => 'Y',
				'=TYPE' => 'LOCATION',
				'=CODE' => 'LOCATION',
			],
			'limit' => 1,
		])->fetch();
		if (!$property)
		{
			return;
		}

		$propertyId = (int)$property['ID'];
		$current = $arUserResult['ORDER_PROP'][$propertyId] ?? '';
		if ($current !== '' && $current !== null && $current !== [])
		{
			return; // значение уже есть (профиль, прошлый заказ) — не трогаем
		}

		// код должен существовать в справочнике местоположений
		$exists = \Bitrix\Sale\Location\LocationTable::getList([
			'select' => ['ID'],
			'filter' => ['=CODE' => $code],
			'limit' => 1,
		])->fetch();
		if ($exists)
		{
			$arUserResult['ORDER_PROP'][$propertyId] = $code;
		}
	}

	private static function cities(): array
	{
		$config = Configuration::getValue('hz_checkout');
		$custom = (is_array($config) && is_array($config['cities'] ?? null)) ? $config['cities'] : [];

		return $custom + self::DEFAULT_CITIES;
	}
}

EventManager::getInstance()->addEventHandler(
	'sale',
	'OnSaleComponentOrderProperties',
	['HzCheckoutLocation', 'onOrderProperties']
);
