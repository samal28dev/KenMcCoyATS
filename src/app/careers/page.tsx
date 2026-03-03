import { Briefcase, Building2, Clock, Heart, MapPin, Search, TrendingUp, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Careers at Ken McCoy - Join Our Team',
  description:
    'Explore exciting career opportunities at Ken McCoy Consulting. We are always looking for talented individuals to join our growing team.',
  openGraph: {
    title: 'Careers at Ken McCoy',
    description: 'Join our team and help us build the future of hiring',
    type: 'website',
  },
}

interface PublicPosition {
  id: string
  title: string
  description: string
  requirements: string[]
  company: string
  location: string
  locationType: string
  status: string
  postedAt: string
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

async function getPositions(): Promise<PublicPosition[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/careers`, {
      next: { revalidate: 60 }, // ISR — revalidate every 60 seconds
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.positions || []
  } catch {
    return []
  }
}

export default async function CareersPage() {
  const positions = await getPositions()

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-purple-700 text-white">
        <div className="absolute inset-0 bg-grid-white/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Join Our Team at Ken McCoy
            </h1>
            <p className="text-xl sm:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Help us revolutionize the hiring process. We're looking for passionate individuals who
              want to make a difference.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#openings"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 md:py-4 md:text-lg md:px-10 transition-colors"
              >
                View Open Positions
              </a>
              <a
                href="#culture"
                className="inline-flex items-center justify-center px-8 py-3 border border-white text-base font-medium rounded-md text-white hover:bg-white/10 md:py-4 md:text-lg md:px-10 transition-colors"
              >
                Learn About Our Culture
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                {positions.length || '0'}
              </div>
              <div className="text-gray-600 dark:text-gray-400 mt-2">Open Positions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                Global
              </div>
              <div className="text-gray-600 dark:text-gray-400 mt-2">Hiring Reach</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                Expert
              </div>
              <div className="text-gray-600 dark:text-gray-400 mt-2">Recruitment Team</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400">Fast</div>
              <div className="text-gray-600 dark:text-gray-400 mt-2">Placement Process</div>
            </div>
          </div>
        </div>
      </section>

      {/* Job Listings Section — from live database */}
      <section id="openings" className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Open Positions
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Find your next career opportunity with us
            </p>
          </div>

          {positions.length === 0 ? (
            <div className="text-center py-16">
              <Briefcase className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No open positions right now
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Check back soon or send us your resume for future opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map((position) => (
                <Link
                  key={position.id}
                  href={`/careers/${position.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {position.title}
                          </h3>
                          <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-4 w-4" />
                              {position.company}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {position.location || 'India'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-4 w-4" />
                              {position.locationType === 'plant' ? 'Plant' : 'Office'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {timeAgo(position.postedAt)}
                            </span>
                          </div>
                        </div>
                        {position.status === 'new' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-3 text-gray-600 dark:text-gray-400 line-clamp-2">
                        {position.description}
                      </p>
                    </div>
                    <div className="mt-4 sm:mt-0 sm:ml-6">
                      <span className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                        Apply Now
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Culture Section */}
      <section id="culture" className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Why Work With Us
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              We offer more than just a job - we offer a career
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mb-4">
                <Users className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Great Team
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Work with talented and passionate people who love what they do
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Growth</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Continuous learning opportunities and career development
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-4">
                <Heart className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Benefits</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Competitive salary, health insurance, and flexible work arrangements
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
                <Building2 className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Remote First
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Work from anywhere with flexible hours and async communication
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Don't see the right position?</h2>
          <p className="text-xl mb-8 text-blue-100">
            We're always looking for talented people. Send us your resume and we'll keep you in mind
            for future opportunities.
          </p>
          <a
            href="mailto:careers@kenmccoy.com"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 md:py-4 md:text-lg md:px-10 transition-colors"
          >
            Send Your Resume
          </a>
        </div>
      </section>
    </div>
  )
}
