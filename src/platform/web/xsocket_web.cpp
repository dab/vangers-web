// Browsers cannot open raw TCP sockets, so the web build runs single-player only.
#include <utility>

#include "xsocket.h"

std::string XSocketLocalHostAddress;
std::string XSocketLocalHostExternalAddress;

int XSocketInit(int) {
	return 0;
}

void XSocketFinit() {}

XSocket::XSocket(): ErrHUsed(1), streamSocket(nullptr), remotePort(0) {}

XSocket::~XSocket() = default;

XSocket::XSocket(XSocket &&donor) noexcept
	: ErrHUsed(donor.ErrHUsed), streamSocket(nullptr),
	  remoteAddress(std::move(donor.remoteAddress)), remotePort(donor.remotePort) {}

XSocket &XSocket::operator=(XSocket &&donor) noexcept {
	ErrHUsed = donor.ErrHUsed;
	remoteAddress = std::move(donor.remoteAddress);
	remotePort = donor.remotePort;
	return *this;
}

int XSocket::open(int, int) {
	return 0;
}

int XSocket::open(const char *, int) {
	return 0;
}

void XSocket::close() {}

int XSocket::send(const char *, int) {
	return 0;
}

int XSocket::send_if_ready(const char *, int) {
	return 0;
}

int XSocket::flush(int) {
	return 0;
}

int XSocket::receive(char *, int, int) {
	return 0;
}

int XSocket::tcp_open(const char *, int) {
	return 0;
}
