<?php
/**
 * /local/templates/omegait_design/components/bitrix/sale.order.ajax/divided-chekout/confirm.php
 *
 * Страница после создания заказа (?ORDER_ID=...): оплата, итоги, состав, доставка.
 * Логика прежняя (вывод формы обработчика платёжной системы, автопереход на ЮKassa/ЮMoney с белым списком
 * доменов), изменено: стили вынесены в hz-checkout.css и ограничены .hz-confirm (прежние inline-стили с
 * общими именами .card/.row/.btn/.badge влияли на весь сайт), разметка на классах hz-confirm__*.
 * Макета этой страницы нет — оформлена токенами дизайн-системы.
 */
if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true)
{
	die();
}

/** @var array $arParams */
/** @var array $arResult */
/** @global CMain $APPLICATION */

if (!function_exists('hzFmtCurrency'))
{
	function hzFmtCurrency($value, $currency)
	{
		if (class_exists('CCurrencyLang'))
		{
			return CCurrencyLang::CurrencyFormat($value, $currency);
		}

		return htmlspecialcharsbx(number_format((float)$value, 2, '.', ' ')).' '.htmlspecialcharsbx($currency);
	}
}

/** Ссылка только http(s) — защита от javascript:/data: в данных из админки. */
if (!function_exists('hzSafeUrl'))
{
	function hzSafeUrl($url)
	{
		$url = trim((string)$url);

		return preg_match('~^https?://~i', $url) ? $url : '';
	}
}

$order = isset($arResult['ORDER']) ? $arResult['ORDER'] : null;
$shipments = isset($arResult['SHIPMENT']) && is_array($arResult['SHIPMENT']) ? $arResult['SHIPMENT'] : [];
$basket = isset($arResult['BASKET']) && is_array($arResult['BASKET']) ? $arResult['BASKET'] : [];
?>
<div class="hz-checkout hz-confirm">
	<?php if (!$order): ?>
		<div class="hz-confirm__card">
			<h2 class="hz-confirm__title">Не удалось получить данные заказа</h2>
			<p class="hz-confirm__muted">Похоже, что заказ не найден или произошла ошибка. Обновите страницу или обратитесь в поддержку.</p>
		</div>
	<?php else: ?>
		<?php
		$orderNumber = htmlspecialcharsbx($order['ACCOUNT_NUMBER'] ?: $order['ID']);
		$orderDate = htmlspecialcharsbx($order['DATE_INSERT_FORMAT'] ?: $order['DATE_INSERT']);
		$statusName = isset($order['STATUS']['NAME']) ? $order['STATUS']['NAME'] : (isset($order['STATUS_ID']) ? $order['STATUS_ID'] : '');
		$isCanceled = (string)($order['CANCELED'] ?? 'N') === 'Y';
		$isAllowPay = (string)($order['IS_ALLOW_PAY'] ?? 'Y') !== 'N';
		$currency = $order['CURRENCY'] ?? 'RUB';
		?>

		<header class="hz-confirm__header">
			<h2 class="hz-confirm__title">Заказ № <?=$orderNumber?> от <?=$orderDate?></h2>
			<div class="hz-confirm__meta">
				<?php if ($isCanceled): ?>
					<span class="hz-confirm__badge hz-confirm__badge--err">Заказ отменён</span>
				<?php elseif (!empty($statusName)): ?>
					<span class="hz-confirm__badge">Статус: <?=htmlspecialcharsbx($statusName)?></span>
				<?php endif; ?>
				<?php if (!empty($order['USER_LOGIN'])): ?>
					<span class="hz-confirm__muted">Покупатель: <?=htmlspecialcharsbx($order['USER_LOGIN'])?></span>
				<?php endif; ?>
			</div>
		</header>

		<div class="hz-confirm__grid">
			<?php if (!empty($arResult['PAYMENT'])): ?>
				<section class="hz-confirm__card hz-confirm__payments">
					<h3 class="hz-confirm__subtitle">Оплата</h3>

					<?php foreach ($arResult['PAYMENT'] as $paymentId => $payment):
						$isPaid = ($payment['PAID'] === 'Y');
						$paySystemName = $payment['PAY_SYSTEM_NAME'] ?? 'Способ оплаты';
						$payFormatted = hzFmtCurrency($payment['SUM'], $payment['CURRENCY']);
						$canPay = !$isPaid && $isAllowPay && !$isCanceled;

						// Платёжная система конкретного платежа
						$paySystem = $arResult['PAY_SYSTEM_LIST_BY_PAYMENT_ID'][$payment['ID'] ?? $paymentId] ?? [];

						$psError = !empty($paySystem['ERROR']);
						$psNewWindow = ($paySystem['PSA_NEW_WINDOW'] ?? 'N') === 'Y';
						$psBuffered = (string)($paySystem['BUFFERED_OUTPUT'] ?? '');

						// Ссылка на /payment/ нужна только если обработчик сам требует отдельное окно
						$payUrl = '';
						if ($canPay && !$psError && $psNewWindow && !empty($arParams['PATH_TO_PAYMENT']))
						{
							$payUrl = $arParams['PATH_TO_PAYMENT']
								.'?ORDER_ID='.rawurlencode((string)($order['ACCOUNT_NUMBER'] ?: $order['ID']))
								.'&PAYMENT_ID='.rawurlencode((string)($payment['ACCOUNT_NUMBER'] ?? $paymentId));
						}

						// Ссылка на оплату из HTML обработчика ЮKassa (для автоперехода)
						$autoPayUrl = '';
						if ($canPay && !$psError && !$psNewWindow && $psBuffered !== ''
							&& preg_match('~<a[^>]+href=(["\'])(.*?)\1~i', $psBuffered, $m))
						{
							$candidate = html_entity_decode($m[2], ENT_QUOTES);
							$parts = parse_url($candidate);
							$host = strtolower($parts['host'] ?? '');
							// Редиректим только на домены платёжного сервиса (защита от open redirect)
							if (($parts['scheme'] ?? '') === 'https' && in_array($host, ['yoomoney.ru', 'yookassa.ru'], true))
							{
								$autoPayUrl = $candidate;
							}
						}
						?>
						<div class="hz-confirm__payment">
							<div class="hz-confirm__payment-info">
								<div class="hz-confirm__strong"><?=htmlspecialcharsbx($paySystemName)?></div>
								<div class="hz-confirm__muted">
									Платёж № <?=htmlspecialcharsbx($payment['ACCOUNT_NUMBER'] ?? $paymentId)?>
									· сумма <?=$payFormatted?>
								</div>
							</div>
							<div class="hz-confirm__payment-action">
								<?php if ($isPaid): ?>
									<span class="hz-confirm__badge hz-confirm__badge--ok">Оплачено</span>
								<?php elseif (!$canPay): ?>
									<?php /* отменён или оплата запрещена — ничего не выводим */ ?>
								<?php elseif ($psError): ?>
									<span class="hz-confirm__badge hz-confirm__badge--err"><?=htmlspecialcharsbx($paySystem['ERROR'])?></span>
								<?php elseif ($payUrl): ?>
									<a class="hz-btn" href="<?=htmlspecialcharsbx($payUrl)?>">Оплатить <?=$payFormatted?></a>
								<?php elseif ($psBuffered !== ''): ?>
									<?php /* HTML обработчика платёжной системы (форма/кнопка/виджет), не экранировать */ ?>
									<?=$psBuffered?>
								<?php endif; ?>
							</div>
						</div>
						<?php if ($autoPayUrl !== ''): ?>
							<script>
							(function () {
								var key = 'autoPay_<?=(int)$order['ID']?>_<?=(int)($payment['ID'] ?? 0)?>';
								try {
									// один автопереход на платёж: при возврате с оплаты покажем обычную кнопку
									if (sessionStorage.getItem(key)) return;
									sessionStorage.setItem(key, '1');
								} catch (e) {}
								window.location.replace(<?=CUtil::PhpToJSObject($autoPayUrl)?>);
							})();
							</script>
						<?php endif; ?>
					<?php endforeach; ?>
				</section>
			<?php endif; ?>

			<aside class="hz-confirm__card hz-confirm__totals">
				<h3 class="hz-confirm__subtitle">Итоги заказа</h3>
				<?php
				$itemsCount = 0;
				foreach ($basket as $b)
				{
					$itemsCount += (float)($b['QUANTITY'] ?? 0);
				}

				$productSum = $order['PRODUCT_SUM'] ?? null;
				$discount = $order['DISCOUNT_VALUE'] ?? ($order['PRODUCT_SUM_DISCOUNT'] ?? null);
				$delivery = $order['PRICE_DELIVERY'] ?? null;
				$tax = $order['TAX_VALUE'] ?? null;
				$total = $order['PRICE'] ?? null;
				?>
				<?php if ($productSum !== null): ?>
					<div class="hz-confirm__row"><span>Товары<?=$itemsCount ? ' ('.(int)$itemsCount.')' : ''?></span><strong><?=hzFmtCurrency($productSum, $currency)?></strong></div>
				<?php endif; ?>
				<?php if (!empty($discount)): ?>
					<div class="hz-confirm__row"><span>Скидка</span><strong>-<?=hzFmtCurrency($discount, $currency)?></strong></div>
				<?php endif; ?>
				<?php if (!empty($delivery)): ?>
					<div class="hz-confirm__row"><span>Доставка</span><strong><?=hzFmtCurrency($delivery, $currency)?></strong></div>
				<?php endif; ?>
				<?php if (!empty($tax)): ?>
					<div class="hz-confirm__row"><span>Налоги</span><strong><?=hzFmtCurrency($tax, $currency)?></strong></div>
				<?php endif; ?>
				<?php if ($total !== null): ?>
					<div class="hz-confirm__row hz-confirm__row--total"><span>Итого к оплате</span><strong><?=hzFmtCurrency($total, $currency)?></strong></div>
				<?php endif; ?>
			</aside>

			<?php if ($basket): ?>
				<section class="hz-confirm__card hz-confirm__wide">
					<h3 class="hz-confirm__subtitle">Состав заказа</h3>
					<?php foreach ($basket as $item):
						$name = htmlspecialcharsbx($item['NAME'] ?? 'Товар');
						$qty = (float)($item['QUANTITY'] ?? 1);
						$measure = htmlspecialcharsbx($item['MEASURE_NAME'] ?? 'шт');
						$priceFormatted = $item['PRICE_FORMATED'] ?? hzFmtCurrency(($item['PRICE'] ?? 0), $currency);
						$sumFormatted = !empty($item['SUM']) ? hzFmtCurrency($item['SUM'], $currency) : ($item['FORMATED_SUM'] ?? '');
						$thumb = '';
						if (isset($item['PICTURE']) && is_array($item['PICTURE']))
						{
							$thumb = $item['PICTURE']['SRC'];
						}
						elseif (!empty($item['DETAIL_PICTURE_SRC']))
						{
							$thumb = $item['DETAIL_PICTURE_SRC'];
						}
						?>
						<article class="hz-confirm__product">
							<?php if ($thumb): ?>
								<img class="hz-confirm__thumb" src="<?=htmlspecialcharsbx($thumb)?>" alt="" loading="lazy">
							<?php else: ?>
								<div class="hz-confirm__thumb" aria-hidden="true"></div>
							<?php endif; ?>
							<div>
								<div class="hz-confirm__strong"><?=$name?></div>
								<div class="hz-confirm__muted">Количество: <?=$qty?> <?=$measure?> · Цена: <?=$priceFormatted?><?=$sumFormatted ? ' · Сумма: '.$sumFormatted : ''?></div>
							</div>
							<div class="hz-confirm__strong"><?=$sumFormatted ?: $priceFormatted?></div>
						</article>
					<?php endforeach; ?>
				</section>
			<?php endif; ?>

			<?php if ($shipments): ?>
				<section class="hz-confirm__card hz-confirm__wide">
					<h3 class="hz-confirm__subtitle">Доставка</h3>
					<?php foreach ($shipments as $s):
						$deliveryName = htmlspecialcharsbx($s['DELIVERY_NAME'] ?? ($s['DELIVERY']['NAME'] ?? 'Доставка'));
						$deliveryPrice = $s['PRICE_DELIVERY_FORMATED'] ?? hzFmtCurrency(($s['PRICE_DELIVERY'] ?? 0), $currency);
						$addressParts = [];
						if (!empty($s['ADDRESS']))
						{
							$addressParts[] = $s['ADDRESS'];
						}
						if (!empty($s['LOCATION']))
						{
							$addressParts[] = $s['LOCATION'];
						}
						$address = htmlspecialcharsbx(implode(', ', $addressParts));
						$track = htmlspecialcharsbx($s['TRACKING_NUMBER'] ?? '');
						$trackUrl = htmlspecialcharsbx(hzSafeUrl($s['TRACKING_URL'] ?? ''));
						?>
						<div class="hz-confirm__row hz-confirm__row--top">
							<div>
								<div class="hz-confirm__strong"><?=$deliveryName?></div>
								<div class="hz-confirm__muted"><?=$address?></div>
								<?php if ($track): ?>
									<div class="hz-confirm__muted">Трек-номер: <?=$track?> <?php if ($trackUrl): ?>· <a class="hz-link" href="<?=$trackUrl?>" target="_blank" rel="noopener noreferrer">Отследить</a><?php endif; ?></div>
								<?php endif; ?>
							</div>
							<strong><?=$deliveryPrice?></strong>
						</div>
					<?php endforeach; ?>
				</section>
			<?php endif; ?>

			<section class="hz-confirm__actions hz-confirm__wide">
				<?php if (!empty($arParams['PATH_TO_PERSONAL'])): ?>
					<a class="hz-btn hz-btn--outline" href="<?=htmlspecialcharsbx($arParams['PATH_TO_PERSONAL'])?>">Перейти в личный кабинет</a>
				<?php endif; ?>
				<a class="hz-btn hz-btn--outline" href="/">Вернуться на главную</a>
			</section>
		</div>
	<?php endif; ?>
</div>
