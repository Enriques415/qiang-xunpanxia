export function htmlSnippet(input: { endpoint: string; accessKey: string; redirect?: string }): string {
  const redirect = input.redirect
    ? `\n  <input type="hidden" name="_redirect" value="${input.redirect}">`
    : "";
  return `<form method="post" action="${input.endpoint}">
  <input type="hidden" name="access_key" value="${input.accessKey}">${redirect}
  <input type="hidden" name="_opened_at" value="">
  <div style="position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden" aria-hidden="true">
    <label>Leave this empty<input name="_hp" tabindex="-1" autocomplete="off"></label>
  </div>
  <label>Name<br><input name="name" autocomplete="name"></label>
  <label>Company<br><input name="company" autocomplete="organization"></label>
  <label>Email<br><input name="email" type="email" autocomplete="email"></label>
  <label>Phone / WhatsApp<br><input name="phone" autocomplete="tel"></label>
  <label>Country<br><input name="country"></label>
  <label>Product<br><input name="product"></label>
  <label>Quantity<br><input name="quantity"></label>
  <label>Message<br><textarea name="message" rows="5"></textarea></label>
  <button type="submit">Send inquiry</button>
</form>
<script>
  document.currentScript.previousElementSibling.querySelector('[name="_opened_at"]').value = Date.now();
</script>`;
}

export function fetchSnippet(endpoint: string): string {
  return `await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Access-Key": "YOUR_ACCESS_KEY"
  },
  body: JSON.stringify({
    name: "Ada Lee",
    company: "Northwind Trading",
    email: "ada@northwind.example",
    product: "Brass valve",
    quantity: "500",
    message: "Please quote FOB Shanghai."
  })
});`;
}

export function shopifySection(endpoint: string): string {
  return `{% comment %}
  询盘匣 · Shopify 主题片段
  放到 sections/inquiry-box.liquid，再在产品页或联系页添加这个 section。
  不需要上架应用市场。
{% endcomment %}
<form method="post" action="${endpoint}">
  <input type="hidden" name="access_key" value="YOUR_ACCESS_KEY">
  <input type="hidden" name="_redirect" value="{{ shop.url }}/pages/thank-you">
  <input type="hidden" name="_opened_at" value="">
  <div style="position:absolute;left:-10000px;height:1px;overflow:hidden" aria-hidden="true">
    <label>Leave this empty<input name="_hp" tabindex="-1" autocomplete="off"></label>
  </div>
  <label>Name<br><input name="name"></label>
  <label>Company<br><input name="company"></label>
  <label>Email<br><input name="email" type="email"></label>
  <label>Phone / WhatsApp<br><input name="phone"></label>
  <label>Country<br><input name="country"></label>
  <label>Product<br><input name="product" value="{{ product.title }}"></label>
  <label>Quantity<br><input name="quantity"></label>
  <label>Message<br><textarea name="message" rows="5"></textarea></label>
  <button type="submit">Send inquiry</button>
</form>
<script>
  document.currentScript.previousElementSibling.querySelector('[name="_opened_at"]').value = Date.now();
</script>

{% schema %}
{
  "name": "Inquiry box",
  "settings": [],
  "presets": [{ "name": "Inquiry box" }]
}
{% endschema %}`;
}
