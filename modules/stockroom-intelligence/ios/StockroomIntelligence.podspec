Pod::Spec.new do |s|
  s.name = 'StockroomIntelligence'
  s.version = '0.1.0'
  s.summary = 'On-device count drafts for Stockroom.'
  s.description = 'Foundation Models proposals with source-grounded validation in the app.'
  s.author = 'Owais Munawwar'
  s.homepage = 'https://github.com/OwaisMunawar/stockroom'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '16.4' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '6.0'
  # SDK 57's prebuilt umbrella headers forward-declare React protocols.
  # Suppress imported Clang diagnostics; keep our Swift warnings as errors.
  s.pod_target_xcconfig = { 'SWIFT_STRICT_CONCURRENCY' => 'complete', 'SWIFT_TREAT_WARNINGS_AS_ERRORS' => 'YES', 'OTHER_SWIFT_FLAGS' => '$(inherited) -Xcc -w' }
end
