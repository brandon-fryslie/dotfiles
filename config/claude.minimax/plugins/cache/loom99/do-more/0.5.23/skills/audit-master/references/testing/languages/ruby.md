# Ruby Testing Reference

## Framework Detection

```bash
# Check Gemfile
grep -E "rspec|minitest|test-unit" Gemfile
```

| Framework | Indicator | Recommended |
|-----------|-----------|-------------|
| RSpec | `rspec-rails`, `rspec` | ✅ Rails standard |
| Minitest | `minitest` | ✅ Built-in, lightweight |
| Test::Unit | `test-unit` | Legacy |

## Test File Patterns

```bash
# RSpec
find . -path "*/spec/*" -name "*_spec.rb" | head -30

# Minitest
find . -path "*/test/*" -name "*_test.rb" | head -30
```

## Coverage Tools

### SimpleCov (Standard)

```ruby
# spec/spec_helper.rb or test/test_helper.rb
require 'simplecov'
SimpleCov.start 'rails' do
  enable_coverage :branch  # Branch coverage
  minimum_coverage 80
  minimum_coverage_by_file 70
end
```

**Run:**
```bash
bundle exec rspec  # or rake test
# Report at coverage/index.html
```

### Coverage in CI
```ruby
SimpleCov.start do
  if ENV['CI']
    formatter SimpleCov::Formatter::SimpleFormatter
  else
    formatter SimpleCov::Formatter::HTMLFormatter
  end
end
```

## Test Categories

### RSpec Tags

```ruby
RSpec.describe User, :unit do
  it "validates email" do
    # Fast unit test
  end
end

RSpec.describe "API", :integration do
  it "creates user" do
    # Integration test
  end
end

RSpec.describe "Login flow", :e2e, :js do
  it "user can login" do
    # E2E with JavaScript
  end
end
```

**Run by tag:**
```bash
rspec --tag unit
rspec --tag ~e2e        # Exclude e2e
rspec --tag type:model  # Rails convention
```

### Minitest Categories

```ruby
class UnitTest < Minitest::Test
  # Unit tests
end

class IntegrationTest < ActionDispatch::IntegrationTest
  # Integration tests
end
```

## Common Patterns to Audit

### RSpec Expectations

```ruby
RSpec.describe User do
  subject { described_class.new(name: "Alice") }

  it { is_expected.to be_valid }

  it "has correct name" do
    expect(subject.name).to eq("Alice")
  end

  it "validates presence of email" do
    subject.email = nil
    expect(subject).not_to be_valid
    expect(subject.errors[:email]).to include("can't be blank")
  end
end
```

### Factory Bot (Test Data)

```ruby
# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    name { "Test User" }
    email { Faker::Internet.email }

    trait :admin do
      role { :admin }
    end
  end
end

# In tests
let(:user) { create(:user) }
let(:admin) { create(:user, :admin) }
```

### Mocking with RSpec

**Good** - Verify behavior:
```ruby
let(:mailer) { instance_double(UserMailer) }

before do
  allow(UserMailer).to receive(:new).and_return(mailer)
  allow(mailer).to receive(:welcome_email)
end

it "sends welcome email" do
  service.create_user(params)
  expect(mailer).to have_received(:welcome_email)
end
```

**Bad** - Over-stubbing:
```ruby
# Stubbing the object under test
allow(user).to receive(:save).and_return(true)  # Tests nothing!
```

### VCR (HTTP Recording)

```ruby
VCR.configure do |c|
  c.cassette_library_dir = "spec/cassettes"
  c.hook_into :webmock
end

RSpec.describe "External API" do
  it "fetches data", :vcr do
    response = ExternalService.fetch_data
    expect(response).to be_success
  end
end
```

## Rails-Specific Testing

### Request Specs (API)

```ruby
RSpec.describe "Users API", type: :request do
  describe "POST /users" do
    it "creates user" do
      post users_path, params: { user: { name: "Test" } }

      expect(response).to have_http_status(:created)
      expect(json_response["name"]).to eq("Test")
    end
  end
end
```

### System Specs (E2E with Capybara)

```ruby
RSpec.describe "Login", type: :system do
  before do
    driven_by(:selenium_chrome_headless)
  end

  it "user can login" do
    user = create(:user, password: "password")

    visit login_path
    fill_in "Email", with: user.email
    fill_in "Password", with: "password"
    click_button "Sign in"

    expect(page).to have_content("Welcome")
    expect(current_path).to eq(dashboard_path)
  end
end
```

### Model Specs

```ruby
RSpec.describe User, type: :model do
  describe "validations" do
    it { should validate_presence_of(:email) }
    it { should validate_uniqueness_of(:email) }
  end

  describe "associations" do
    it { should have_many(:posts) }
    it { should belong_to(:organization) }
  end
end
```

## Quality Checks

### Find Tests Without Assertions
```bash
grep -L "expect\|assert\|should" spec/**/*_spec.rb
```

### Find Pending/Skipped Tests
```bash
grep -rn "pending\|skip\|xit\|xdescribe" spec/
```

### Find Focused Tests
```bash
grep -rn "fit\|fdescribe\|focus: true" spec/  # Should not be committed
```

### Check Factory Usage
```bash
# Factories vs fixtures
grep -rn "create(\|build(" spec/ | wc -l
grep -rn "fixtures" spec/ | wc -l
```

## CI Configuration

### GitHub Actions
```yaml
- name: Test
  run: |
    bundle exec rspec --format progress --format RspecJunitFormatter -o results.xml
  env:
    RAILS_ENV: test
```

### Parallel Tests
```ruby
# Gemfile
gem 'parallel_tests', group: :test
```

```bash
rake parallel:spec
```

## Directory Convention

### Rails/RSpec
```
spec/
├── models/           # Unit tests
├── controllers/      # Controller specs (legacy)
├── requests/         # API integration
├── system/           # E2E with Capybara
├── services/         # Service object tests
├── jobs/             # Background job tests
├── factories/        # FactoryBot definitions
├── support/          # Shared helpers
└── spec_helper.rb
```

### Minitest
```
test/
├── models/
├── controllers/
├── integration/
├── system/
├── fixtures/
└── test_helper.rb
```

## Shoulda Matchers

```ruby
# spec/rails_helper.rb
Shoulda::Matchers.configure do |config|
  config.integrate do |with|
    with.test_framework :rspec
    with.library :rails
  end
end
```

One-liner validations:
```ruby
it { should validate_presence_of(:name) }
it { should have_many(:comments).dependent(:destroy) }
it { should allow_value("email@example.com").for(:email) }
```
