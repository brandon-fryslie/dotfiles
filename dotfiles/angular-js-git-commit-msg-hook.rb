#!/usr/bin/env ruby
message_file = ARGV[0]
message = File.read(message_file)

regex = /^(.+?)(\(.+?\))?:(.+?)|revert: /

if !regex.match(message.split('\n')[0])
  puts "Olé!  Your message is not formatted correctly!"
  puts "try: <type>(<scope>): <subject>"
  exit 1
end