# PhenomeBeauty Payment Flow - Test Checklist

## Before Testing
- [ ] Ensure Google Sheets has test bookings
- [ ] Verify `app_base_url` is set to production URL
- [ ] Check Yoco/PayFast credentials are configured

## Deposit Payment Flow
- [ ] Complete booking form with all details
- [ ] Submit and get redirected to payment gateway
- [ ] Complete test payment
- [ ] Verify redirect to `/thankyou.html?ref={ID}`
- [ ] Confirm booking date and time display correctly
- [ ] Check email confirmation received
- [ ] Refresh page and verify redirect back to booking

## Balance Payment Flow
- [ ] Request balance payment from admin panel
- [ ] Customer clicks payment link
- [ ] Complete payment
- [ ] Verify redirect to thank you page
- [ ] Confirm balance payment recorded in sheet

## Visual Checks
- [ ] Thank you page matches booking page styling
- [ ] Logo displays correctly
- [ ] Text hierarchy is correct
- [ ] Mobile responsive design works
- [ ] Liquid glass effects render properly

## Edge Cases
- [ ] Invalid booking ref shows graceful error
- [ ] Network failure doesn't break page
- [ ] Multiple refreshes don't cause issues
- [ ] Session storage works across tabs

